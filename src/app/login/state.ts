export type LoginState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialLoginState: LoginState = {
  status: "idle",
  message: "",
};
