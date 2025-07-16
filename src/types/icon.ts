import type { SvgIconTypeMap } from "@mui/material";
import type { OverridableComponent } from "@mui/material/OverridableComponent";

export type IconComponent = OverridableComponent<SvgIconTypeMap> & {
  muiName: string;
};
