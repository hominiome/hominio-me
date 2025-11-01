import { json } from "@sveltejs/kit";
import { getSession } from "$lib/api-helpers.server.js";
import { isAdmin } from "$lib/admin.server";

export async function GET({ request }) {
    const session = await getSession(request);
    
    if (!session?.user?.id) {
        return json({ isAdmin: false });
    }

    return json({ isAdmin: isAdmin(session.user.id) });
}

