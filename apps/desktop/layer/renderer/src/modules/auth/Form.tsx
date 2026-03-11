import { Button } from "@follow/components/ui/button/index.js"
import { Divider } from "@follow/components/ui/divider/index.js"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@follow/components/ui/form/index.js"
import { Input } from "@follow/components/ui/input/Input.js"
import type { LoginRuntime } from "@follow/shared/auth"
import { env } from "@follow/shared/env.desktop"
import HCaptcha from "@hcaptcha/react-hcaptcha"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"

import { useServerConfigs } from "~/atoms/server-configs"
import { useModalStack } from "~/components/ui/modal/stacked/hooks"
import { loginHandler, sendVerificationEmail, signUp, twoFactor } from "~/lib/auth"
import { handleSessionChanges } from "~/queries/auth"

import { TOTPForm } from "../profile/two-factor"
import { ReferralForm } from "./ReferralForm"

const createFormSchema = (passwordMinMsg: string) =>
  z.object({
    email: z.string().email(),
    password: z.string().min(8, passwordMinMsg).max(128),
  })

export function LoginWithPassword({
  runtime,
  onLoginStateChange,
}: {
  runtime: LoginRuntime
  onLoginStateChange: (state: "register" | "login") => void
}) {
  const { t } = useTranslation("app")
  const { t: tSettings } = useTranslation("settings")
  const formSchema = createFormSchema(t("login.password_min_length"))
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "all",
  })

  const { present, dismissAll } = useModalStack()

  const captchaRef = useRef<HCaptcha>(null)

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const response = await captchaRef.current?.execute({ async: true })
    const res = await loginHandler("credential", runtime, {
      email: values.email,
      password: values.password,
      headers: {
        "x-token": `hc:${response?.response}`,
      },
    })
    if (res?.error) {
      toast.error(res.error.message)
      return
    }

    if (res?.data && "twoFactorRedirect" in res.data && res.data.twoFactorRedirect) {
      present({
        title: tSettings("profile.totp_code.title"),
        content: () => {
          return (
            <TOTPForm
              onSubmitMutationFn={async (values) => {
                const { data, error } = await twoFactor.verifyTotp({ code: values.code })
                if (!data || error) {
                  throw new Error(error?.message ?? "Invalid TOTP code")
                }
              }}
              onSuccess={async () => {
                await handleSessionChanges()
                dismissAll()
              }}
            />
          )
        },
      })
    } else {
      await handleSessionChanges()
      dismissAll()
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("login.email")}</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem className="mt-4">
              <FormLabel className="flex items-center justify-between">
                <span>{t("login.password")}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    window.open(
                      `${env.VITE_WEB_URL}/forget-password`,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }}
                  tabIndex={-1}
                  className="block py-1 text-xs text-accent hover:underline"
                >
                  {t("login.forget_password.note")}
                </button>
              </FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col space-y-3">
          {!import.meta.env.DEV && (
            <HCaptcha sitekey={env.VITE_HCAPTCHA_SITE_KEY} ref={captchaRef} size="invisible" />
          )}
          <Button
            type="submit"
            isLoading={form.formState.isSubmitting}
            disabled={!form.formState.isValid}
            size="lg"
          >
            {t("login.continueWith", { provider: t("words.email") })}
          </Button>
        </div>
      </form>

      <Divider className="my-4" />

      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-center gap-1 pb-2 text-center text-sm"
        onClick={() => onLoginStateChange("register")}
      >
        <Trans
          t={t}
          i18nKey="login.no_account"
          components={{
            strong: <span className="text-accent" />,
          }}
        />
        <i className="i-mgc-right-cute-fi !text-text" />
      </button>
    </Form>
  )
}

const createRegisterFormSchema = (messages: { passwordMin: string; passwordsDontMatch: string }) =>
  z
    .object({
      email: z.string().email(),
      password: z.string().min(8, messages.passwordMin).max(128),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: messages.passwordsDontMatch,
      path: ["confirmPassword"],
    })

export function RegisterForm({
  onLoginStateChange,
}: {
  onLoginStateChange: (state: "register" | "login") => void
}) {
  const { t } = useTranslation("app")
  const [registeredEmail, setRegisteredEmail] = useState("")
  const [isResending, setIsResending] = useState(false)

  const registerFormSchema = createRegisterFormSchema({
    passwordMin: t("login.password_min_length"),
    passwordsDontMatch: t("login.passwords_dont_match"),
  })
  const form = useForm<z.infer<typeof registerFormSchema>>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
    mode: "all",
  })

  const serverConfigs = useServerConfigs()

  const captchaRef = useRef<HCaptcha>(null)

  async function onSubmit(values: z.infer<typeof registerFormSchema>) {
    const response = await captchaRef.current?.execute({ async: true })
    return signUp.email({
      email: values.email,
      password: values.password,
      name: values.email.split("@")[0]!,
      callbackURL: "/",
      fetchOptions: {
        onSuccess() {
          setRegisteredEmail(values.email)
        },
        onError(context) {
          toast.error(context.error.message)
        },
        headers: {
          "x-token": `hc:${response?.response}`,
        },
      },
    })
  }

  if (registeredEmail) {
    return (
      <div className="flex flex-col items-center space-y-4 py-4">
        <i className="i-mgc-mail-cute-re text-4xl text-accent" />
        <h2 className="text-lg font-semibold">{t("register.verify_email.title")}</h2>
        <p className="text-center text-sm text-text-secondary">
          {t("register.verify_email.description", { email: registeredEmail })}
        </p>
        <Button
          variant="outline"
          isLoading={isResending}
          onClick={async () => {
            setIsResending(true)
            try {
              await sendVerificationEmail({ email: registeredEmail })
              toast.success(t("register.verify_email.resend_success"))
            } finally {
              setIsResending(false)
            }
          }}
        >
          {t("register.verify_email.resend")}
        </Button>
        <button
          type="button"
          className="text-sm text-accent hover:underline"
          onClick={() => onLoginStateChange("login")}
        >
          {t("register.verify_email.back_to_sign_in")}
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("register.email")}</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
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
                  <Input type="password" {...field} />
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
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {serverConfigs?.REFERRAL_ENABLED && <ReferralForm className="mb-4 w-full" align="left" />}
          {!import.meta.env.DEV && (
            <HCaptcha sitekey={env.VITE_HCAPTCHA_SITE_KEY} ref={captchaRef} size="invisible" />
          )}
          <Button type="submit" buttonClassName="w-full" size="lg">
            {t("register.submit")}
          </Button>
        </form>
      </Form>
      <Divider className="my-4" />

      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-center gap-1 pb-2 text-center text-sm"
        onClick={() => onLoginStateChange("login")}
      >
        <Trans
          t={t}
          i18nKey="login.have_account"
          components={{
            strong: <span className="text-accent" />,
          }}
        />
        <i className="i-mgc-right-cute-fi !text-text" />
      </button>
    </div>
  )
}
