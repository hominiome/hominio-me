import { createAuthClient } from "better-auth/svelte";
import { polarClient } from "@polar-sh/better-auth";

export const authClient = createAuthClient({
  plugins: [polarClient()],
});

