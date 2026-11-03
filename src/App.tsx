/**
 * TG. Dizi Film Application Root
 */
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import { useMemo } from "react";

export default function App() {
  const router = useMemo(() => getRouter(), []);
  return <RouterProvider router={router} />;
}
