"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { PlusCircle, LogOut, LoaderCircle, ArrowLeftRight } from "lucide-react";
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
      const res = await axios.get("/api/logout");

      if (res.status === 200) {
        toast.success("Logout successful");
        setTimeout(() => router.push("/login"), 500);
      } else {
        toast.error("Logout failed");
      }
    } catch (error) {
      console.error("Logout Error:", error);
      toast.error("Logout failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {isLoading && (
         <div className="fixed inset-0 flex justify-center items-center bg-black/20 backdrop-blur-sm z-50">
          <Spin size="large" indicator={<LoaderCircle className="animate-spin" color="#1ca5b3" />} />
        </div>
      )}

      <header className="w-full rounded bg-white shadow-md">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 sm:h-20 items-center justify-between">
            {/* Logo */}
            <div
              onClick={handleLogoClick}
              className="flex items-center cursor-pointer flex-shrink-0 transition-transform hover:scale-105"
            >
              <Image
                src={logo || "/placeholder.svg"}
                alt="Grundfos Logo"
                className="h-10 sm:h-12 md:h-14 w-auto"
                width={300}
                height={40}
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* DB Sync Button */}
              <Button
                onClick={() => router.push("/db-sync")}
                className="flex items-center bg-[#10b981] hover:bg-[#059669] text-white rounded-lg shadow-sm px-3 sm:px-4 py-2 transition-all duration-200"
              >
                <ArrowLeftRight className="w-4 h-4 sm:w-5 sm:h-5 mr-1" />
                <span className="hidden sm:inline">DB Sync</span>
              </Button>

              {/* Add IP Button */}
              <Button
                onClick={openModal}
                className="flex items-center bg-[#1ca5b3] hover:bg-[#0e7c87] text-white rounded-lg shadow-sm px-3 sm:px-4 py-2 transition-all duration-200"
              >
                <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-1" />
                <span className="hidden sm:inline">Add</span>
              </Button>

              {/* Logout Button */}
              <Button
                onClick={handleLogout}
                className="flex items-center bg-[#f87171] hover:bg-[#dc2626] text-white rounded-lg shadow-sm px-3 sm:px-4 py-2 transition-all duration-200"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5 mr-1" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {isModalOpen && <IPPortForm />}
    </>
  );
}
