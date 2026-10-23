import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

//Paginas
import Dashboard from "./routes/dashboard/page";
import Inventory from "./routes/inventory/page";
import Documents from "./routes/documents/page";
import Pages from "./routes/pages/page";
import Roles from "./routes/roles/page";
import Sales from "./routes/sales/page";
import Schedule from "./routes/schedule/page";
import Layout from "./components/layout/Layout";
import Pruebas from "./routes/pruebas/page";
import ProtectedModule from "./components/global/ProtectedModule";
import Stores from "./routes/stores/page";
import Staff from "./routes/staff/page";
import Clients from "./routes/clients/page";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <ProtectedModule page="Dashboard" type="read" method="block"  >
          <Dashboard />
        </ProtectedModule>,
      },
      {
        path: "roles",
        element: <ProtectedModule page="Roles" type="read" method="block" >
          <Roles />
        </ProtectedModule>,
      },
      {
        path: "pages",
        element: <ProtectedModule page="Pages" type="read" method="block" >
          <Pages />
        </ProtectedModule>,
      },
      {
        path: "stores",
        element: <ProtectedModule page="Stores" type="read" method="block" >
          <Stores />
        </ProtectedModule>,
      },
      {
        path: "staff",
        element: <ProtectedModule page="Staff" type="read" method="block" >
          <Staff />
        </ProtectedModule>,
      },
      {
        path: "clients",
        element: <ProtectedModule page="Staff" type="read" method="block" >
          <Clients />
        </ProtectedModule>,
      },
      {
        path: "inventory",
        element: <ProtectedModule page="Inventory" type="read" method="block" >
          <Inventory />
        </ProtectedModule>,
      },
      {
        path: "documents",
        element: <ProtectedModule page="Inventory" type="read" method="block" >
          <Documents />
        </ProtectedModule>,
      },
      {
        path: "sales",
        element: <ProtectedModule page="Sales" type="read" method="block" >
          <Sales />
        </ProtectedModule>,
      },
      {
        path: "schedule",
        element: <ProtectedModule page="Schedule" type="read" method="block" >
          <Schedule />
        </ProtectedModule>,
      },
      {
        path: "pruebas",
        element: <Pruebas />,
      },
    ],
  },
]);



export default function Routes() {
  return <RouterProvider router={router} />;
}