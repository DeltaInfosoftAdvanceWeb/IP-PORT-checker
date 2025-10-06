"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { useRouter } from "next/navigation";
import axios from "axios";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";


const formSchema = z.object({
  email: z.string().min(1, "Employee ID is required"),
  password: z.string().min(4, "Password must be at least 4 characters"),
});


export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const [loaderText, setLoaderText] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values) {
    setIsLoading(true);
    try {
      setLoaderText("Logging in...");

      const response = await axios.post("/api/login", values);

      if (response.data.status === 200) {
        toast.success("Login successful");
        router.push("/");
      } else {
        if (response.data.message == "User not found") {
          toast.error("User Not Found, Request accesss");
          router.push("/signup");
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
      setLoaderText("");
    }
  }

  return (
    <div className="min-h-screen  flex items-center justify-center bg-gradient-to-b from-[#1ca5b3] to-white p-4">
      <Toaster position="bottom-right" />
      <div className="w-full flex justify-center items-center">
        <div className="rounded-3xl p-8 shadow-2xl bg-gradient-to-b from-[#1ca5b3]  to-white  text-white w-[500px] py-10">
          <h1 className="text-2xl font-semibold text-white mb-6">Login</h1>
          {/* <Image src={"/logo.png"} width={500} height={400} alt="Logo" className="mix-blend-darker" /> */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your email"
                        className="rounded  bg-white border-gray-300 text-black"
                        {...field}
                      />
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
                    <FormLabel className="text-white">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          className="rounded bg-white text-black border-gray-300 pr-10"
                          placeholder="Enter your password"
                          {...field}
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5 text-[#16808c]" />
                          ) : (
                            <Eye className="h-5 w-5 text-[#16808c]" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="button"
                variant="link"
                className="text-[#1ca5b3] hover:text-[#16808c] p-0 h-auto font-normal"
              >
                Forgot Password?
              </Button>

              <Button
                type="submit"
                className="w-full bg-[#1ca5b3] text-white hover:bg-[#16808c] rounded"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {loaderText}
                  </>
                ) : (
                  "Log In"
                )}
              </Button>
            </form>
          </Form>
          <p className="mt-3 text-center text-black text-sm">
            Don’t have an account yet?{" "}
            <Button
              variant="link"
              onClick={() => {
                router.push("/signup");
              }}
              className="font-medium text-[#1ca5b3] hover:text-[#16808c]"
            >
              Sign up now
            </Button>
          </p>
        </div>
      </div>
    </div>
  );
}
