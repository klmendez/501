export type Promotion = {
  id: string;
  title: string;
  label: string;
  description: string;
  productReference: string;
  placement: "banner" | "destacado";
  active: boolean;
};
