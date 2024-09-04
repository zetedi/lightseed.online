import { Outlet } from "react-router-dom";
import { SiteHeader } from "@/components/site-header";

function Layout() {
  return (
    <div>
      <SiteHeader />
      <Outlet />
    </div>
  );
}

export default Layout;
