import { Outlet } from "react-router-dom";
import { SiteHeader } from "@/components/utils/layout/SiteHeader";

function Layout() {
  return (
    <div>
      <SiteHeader />
      <Outlet />
    </div>
  );
}

export default Layout;
