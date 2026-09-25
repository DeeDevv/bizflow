import type { Metadata } from "next";
import { MyActivity } from "@/components/employee/MyActivity";

export const metadata: Metadata = {
  title: "My Activity",
};

export default function EmployeeActivityPage() {
  return <MyActivity />;
}
