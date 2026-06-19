import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const nav = useNavigate();
  useEffect(() => {
    nav({ to: "/login" });
  }, [nav]);
  return null;
}
