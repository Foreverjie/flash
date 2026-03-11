import { useServerConfigs } from "@client/atoms/server-configs"
import { loginHandler, sendVerificationEmail, signUp } from "@client/lib/auth"
import { ReferralForm } from "@client/modules/referral"
import { useAuthProviders } from "@client/query/users"
import { Logo } from "@follow/components/icons/logo.jsx"
import { Button, MotionButtonBase } from "@follow/components/ui/button/index.jsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@follow/components/ui/card/index.jsx"
import { Divider } from "@follow/components/ui/divider/index.js"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@follow/components/ui/form/index.jsx"
import { Input } from "@follow/components/ui/input/index.js"
import { useIsDark } from "@follow/hooks"
import { env } from "@follow/shared/env.ssr"
import { tracker } from "@follow/tracker"
import { cn } from "@follow/utils/utils"
import HCaptcha from "@hcaptcha/react-hcaptcha"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useRef, useState } from "react"
import * as React from "react"
import { useForm } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router"
import { toast } from "sonner"
import { z } from "zod"

export function Component() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8">
      <Logo className="size-16" />
      <RegisterForm />
    </div>
  )
}

const formSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

function RegisterForm() {
  const serverConfigs = useServerConfigs()
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState("")
  const navigate = useNavigate()
  const captchaRef = useRef<HCaptcha>(null)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  })
  const [isEmail, setIsEmail] = useState(false)
  const isDark = useIsDark()

  const resendMutation = useMutation({
    mutationFn: async () => {
      await sendVerificationEmail({ email: registeredEmail })
    },
    onSuccess: () => {
      toast.success(t("register.verify_email.resend_success"))
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const { data: authProviders } = useAuthProviders()

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true)

    try {
      let token = ""

      if (import.meta.env.DEV) {
        token = "dev-bypass-token"
      } else {
        const response = await captchaRef.current?.execute({ async: true })

        if (!response?.response) {
          return
        }
        token = response.response
      }

      await signUp.email({
        email: values.email,
        password: values.password,
        name: values.email.split("@")[0]!,
        callbackURL: "/",
        fetchOptions: {
          onSuccess() {
            tracker.register({
              type: "email",
            })
            setRegisteredEmail(values.email)
          },
          onError(context) {
            toast.error(context.error.message)
          },
          headers: {
            "x-token": `hc:${token}`,
          },
        },
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (registeredEmail) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="w-[500px] max-w-full">
          <CardHeader>
            <CardTitle>{t("register.verify_email.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CardDescription>
              {t("register.verify_email.description", { email: registeredEmail })}
            </CardDescription>
            <div className="flex justify-center">
              <Button
                variant="outline"
                isLoading={resendMutation.isPending}
                onClick={() => resendMutation.mutate()}
              >
                {t("register.verify_email.resend")}
              </Button>
            </div>
            <Link to="/login" className="block text-center text-sm text-accent hover:underline">
              {t("register.verify_email.back_to_sign_in")}
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="relative min-w-80">
      <h1 className="mb-8 text-center text-3xl">
        {t("login.signUpTo")} <b>{` ${APP_NAME}`}</b>
      </h1>
      {isEmail ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("register.email")}</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("register.password")}</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("register.confirm_password")}</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {serverConfigs?.REFERRAL_ENABLED && <ReferralForm align="left" />}
            {import.meta.env.DEV ? (
              <div className="text-center text-xs text-accent">hCaptcha disabled in dev</div>
            ) : (
              <HCaptcha ref={captchaRef} sitekey={env.VITE_HCAPTCHA_SITE_KEY} size="invisible" />
            )}
            <Button
              isLoading={isSubmitting}
              disabled={isSubmitting}
              type="submit"
              buttonClassName="w-full"
              size="lg"
            >
              {t("register.submit")}
            </Button>
          </form>
        </Form>
      ) : (
        <div className="mb-3 flex flex-col items-center justify-center gap-4">
          {Object.entries(authProviders || []).map(([key, provider]) => (
            <MotionButtonBase
              key={key}
              onClick={() => {
                if (key === "credential") {
                  setIsEmail(true)
                } else {
                  loginHandler(key, "app")
                }
              }}
              className="center relative w-full gap-2 rounded-xl border p-2.5 pl-5 font-semibold duration-200 hover:bg-material-medium"
            >
              <img
                className={cn(
                  "absolute left-9 h-5",
                  !provider.iconDark64 && "dark:brightness-[0.85] dark:hue-rotate-180 dark:invert",
                )}
                src={isDark ? provider.iconDark64 || provider.icon64 : provider.icon64}
              />
              <span>{t("login.continueWith", { provider: provider.name })}</span>
            </MotionButtonBase>
          ))}
          {serverConfigs?.REFERRAL_ENABLED && <ReferralForm />}
        </div>
      )}
      <Divider className="my-7" />
      {isEmail ? (
        <div className="cursor-pointer pb-2 text-center" onClick={() => setIsEmail(false)}>
          Back
        </div>
      ) : (
        <div
          className="cursor-pointer pb-2 text-center"
          onClick={() => {
            navigate("/login")
          }}
        >
          <Trans
            t={t}
            i18nKey="login.have_account"
            components={{
              strong: <span className="text-accent" />,
            }}
          />
        </div>
      )}
    </div>
  )
}
