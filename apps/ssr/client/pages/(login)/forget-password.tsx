import { forgetPassword } from "@client/lib/auth"
import { Button } from "@follow/components/ui/button/index.jsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@follow/components/ui/card/index.jsx"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@follow/components/ui/form/index.jsx"
import { Input } from "@follow/components/ui/input/index.js"
import { env } from "@follow/shared/env.ssr"
import HCaptcha from "@hcaptcha/react-hcaptcha"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useRef, useState } from "react"
import * as React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { toast } from "sonner"
import { z } from "zod"

const createEmailSchema = (t: any) =>
  z.object({
    email: z
      .string()
      .min(1, t("login.forget_password.email_required"))
      .email(t("login.forget_password.email_invalid")),
  })

export function Component() {
  const { t } = useTranslation()

  const [emailSent, setEmailSent] = useState(false)
  const [sentEmail, setSentEmail] = useState("")
  const captchaRef = useRef<HCaptcha>(null)

  const EmailSchema = createEmailSchema(t)

  const form = useForm<z.infer<typeof EmailSchema>>({
    resolver: zodResolver(EmailSchema),
    defaultValues: {
      email: "",
    },
    mode: "onChange",
    delayError: 500,
  })

  const { isValid } = form.formState
  const updateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof EmailSchema>) => {
      let token = ""
      if (import.meta.env.DEV) {
        token = "dev-bypass-token"
      } else {
        const response = await captchaRef.current?.execute({ async: true })
        if (!response?.response) {
          throw new Error("Captcha verification failed")
        }
        token = response.response
      }

      const res = await forgetPassword(
        {
          email: values.email,
          redirectTo: `${env.VITE_WEB_URL}/reset-password`,
        },
        {
          headers: {
            "x-token": `hc:${token}`,
          },
        },
      )
      if (res.error) {
        throw new Error(res.error.message)
      }
    },
    onError: (error) => {
      toast.error(error.message)
    },
    onSuccess: (_data, variables) => {
      setSentEmail(variables.email)
      setEmailSent(true)
    },
  })

  function onSubmit(values: z.infer<typeof EmailSchema>) {
    updateMutation.mutate(values)
  }

  if (emailSent) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="w-[500px] max-w-full">
          <CardHeader>
            <CardTitle>{t("login.forget_password.label")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CardDescription>
              {t("login.forget_password.email_sent_description", { email: sentEmail })}
            </CardDescription>
            <Link to="/login" className="block text-center text-sm text-accent hover:underline">
              {t("login.forget_password.back_to_sign_in")}
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-full items-center justify-center">
      <Card className="w-[500px] max-w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>{t("login.forget_password.label")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="mb-4">
            {t("login.forget_password.description")}
          </CardDescription>
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
              {!import.meta.env.DEV && (
                <HCaptcha ref={captchaRef} sitekey={env.VITE_HCAPTCHA_SITE_KEY} size="invisible" />
              )}
              <div className="text-right">
                <Button
                  disabled={!isValid || updateMutation.isPending}
                  type="submit"
                  isLoading={updateMutation.isPending}
                >
                  {t("login.submit")}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
