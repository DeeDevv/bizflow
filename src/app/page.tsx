import { redirect } from "next/navigation";

/** Landing page simply forwards to the dashboard for now. */
export default function Home() {
  redirect("/dashboard");
}
