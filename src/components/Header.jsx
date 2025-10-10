"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { PlusCircle } from "lucide-react";
import IPPortForm from "./IPPortForm";
import { Button } from "@/components/ui/button";
import { Label } from "./ui/label";
import useIPPortStore from "@/store/useIPPortStore";

import logo from "../../public/logo.png";
import axios from "axios";
import { toast, Toaster } from "react-hot-toast";
import { useState } from "react";
import { Spin } from "antd";

export function Header() {
  const router = useRouter();
  const { isModalOpen, openModal } = useIPPortStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogoClick = () => {
    router.push("/");
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await axios.get("/api/logout");
      toast.success("Logout success");
      router.push("/login");
    } catch (error) {
      console.log(error);

      toast.error("Logout Failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-20 z-50 pointer-events-none">
          <Spin size="large" />
        </div>
      )}
      <Toaster position="bottom-right" />
      <header className="sticky top-0 z-10 w-full bg-white">
        <div className="mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex h-16 sm:h-20 items-center justify-between gap-2">
            <div
              className="flex items-center cursor-pointer flex-shrink-0"
              onClick={handleLogoClick}
            >
              <Image
                src={logo || "/placeholder.svg"}
                alt="Grundfos Logo"
                className="h-10 sm:h-12 md:h-14 w-auto mr-2 sm:mr-4"
                width={300}
                height={40}
              />
            </div>
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              <Label className="hidden sm:block text-sm md:text-base font-semibold capitalize">
                Add IP/PORT
              </Label>
              <Button className="rounded p-2 sm:px-4" onClick={openModal}>
                <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline ml-2">Add</span>
              </Button>
              <Button
                onClick={handleLogout}
                className="rounded bg-[#1ca5b3] hover:bg-[#13717b] text-white text-sm px-3 sm:px-4"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>
      {isModalOpen && <IPPortForm />}
    </>
  );
}
