import { resetPassword } from "@client/lib/auth"
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
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import * as React from "react"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useSearchParams } from "react-router"
import { toast } from "sonner"
import { z } from "zod"

const createPasswordFormSchema = (messages: {
  passwordMin: string
  passwordMax: string
  passwordsDontMatch: string
}) => {
  const passwordSchema = z.string().min(8, messages.passwordMin).max(128, messages.passwordMax)
  return z
    .object({
      newPassword: passwordSchema,
      confirmPassword: passwordSchema,
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: messages.passwordsDontMatch,
      path: ["confirmPassword"],
    })
}

export function Component() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")

  const passwordFormSchema = useMemo(
    () =>
      createPasswordFormSchema({
        passwordMin: t("login.reset_password.password_min"),
        passwordMax: t("login.reset_password.password_max"),
        passwordsDontMatch: t("login.reset_password.passwords_dont_match"),
      }),
    [t],
  )
  const form = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
    mode: "all",
  })

  const { isValid } = form.formState

  const navigate = useNavigate()
  const updateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof passwordFormSchema>) => {
      if (!token) {
        throw new Error(t("login.reset_password.invalid_token"))
      }

      const res = await resetPassword({ newPassword: values.newPassword, token })
      const error = res.error?.message
      if (error) {
        throw new Error(error)
      }
    },
    onError: (error) => {
      toast.error(error.message)
    },
    onSuccess: () => {
      toast.success(t("login.reset_password.success"))
      navigate("/login")
    },
  })

  function onSubmit(values: z.infer<typeof passwordFormSchema>) {
    updateMutation.mutate(values)
  }

  if (!token) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="w-[500px] max-w-full">
          <CardHeader>
            <CardTitle>{t("login.reset_password.label")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              {t("login.reset_password.invalid_token")}
            </CardDescription>
            <Link to="/forget-password" className="text-accent hover:underline">
              {t("login.reset_password.request_new_link")}
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
            <span>{t("login.reset_password.label")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription>{t("login.reset_password.description")}</CardDescription>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("login.new_password.label")}</FormLabel>
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
                    <FormLabel>{t("login.confirm_password.label")}</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="text-right">
                <Button disabled={!isValid} type="submit" isLoading={updateMutation.isPending}>
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
