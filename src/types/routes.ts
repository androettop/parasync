import { IconComponent } from "./icon";

export type Route = {
  /**
   * The label for the route, used in navigation menus and headers.
   */
  label: string;
  /**
   * A unique name for the route, used for identification.
   */
  name: string;
  /**
   * The path for the route, used in routing.
   */
  path: string;
  /**
   * The component to render for this route.
   */
  PageComponent: React.ComponentType;
  /**
   * An optional icon component to display in navigation menus.
   */
  Icon?: IconComponent;
  /**
   * Whether to hide this route in the navigation drawer.
   */
  hideInDrawer?: boolean;
  /**
   * Whether to hide the app bar for this route.
   */
  hideAppbar?: boolean;
  /**
   * Whether to hide the drawer and menu button for this route.
   */
  hideDrawer?: boolean;
  /** Whether the user should be signed in to access this route.
   * @default true
   */
  shouldBeSignedIn?: boolean;
};
