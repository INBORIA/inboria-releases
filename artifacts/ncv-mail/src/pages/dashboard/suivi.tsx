import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Suivi() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/dashboard/taches");
  }, [setLocation]);
  return null;
}
