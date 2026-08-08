const ROBLOX_CLIENT_ID = requireEnv("ROBLOX_CLIENT_ID");
const ROBLOX_CLIENT_SECRET = requireEnv("ROBLOX_CLIENT_SECRET");
const ROBLOX_REDIRECT_URI = requireEnv("ROBLOX_REDIRECT_URI");

const TGAR_GROUP_ID = requireEnv("TGAR_GROUP_ID");

const DISCORD_BOT_TOKEN = requireEnv("DISCORD_BOT_TOKEN");
const DISCORD_GUILD_ID = requireEnv("DISCORD_GUILD_ID");

const VERIFICATION_CHANNEL_ID = requireEnv(
  "VERIFICATION_CHANNEL_ID",
);

const UNVERIFIED_ROLE_ID = requireEnv(
  "UNVERIFIED_ROLE_ID",
);

const VERIFICATION_ROLE_IDS = requireEnv(
  "VERIFICATION_ROLE_IDS",
)
  .split(",")
  .map((roleId) => roleId.trim())
  .filter(Boolean);

const STATE_SECRET = requireEnv("STATE_SECRET");


const ROBLOX_TOKEN_URL =
  "https://apis.roblox.com/oauth/v1/token";

const ROBLOX_USERINFO_URL =
  "https://apis.roblox.com/oauth/v1/userinfo";

const DISCORD_API =
  "https://discord.com/api/v10";


interface VerificationState {
  discord_user_id: string;
  channel_id: string;
  exp: number;
  nonce: string;
}


interface RobloxUserInfo {
  sub: string;
  name?: string;
  nickname?: string;
  preferred_username?: string;
  profile?: string;
  picture?: string | null;
}


interface RobloxGroupRole {
  group: {
    id: number;
    name?: string;
  };
  role: {
    id: number;
    name: string;
    rank: number;
  };
}


interface DiscordMember {
  roles: string[];
  user?: {
    id: string;
    username?: string;
  };
}


interface DiscordRole {
  id: string;
  name: string;
  position: number;
  managed: boolean;
}


function requireEnv(
  name: string,
): string {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
}


function htmlResponse(
  title: string,
  message: string,
  success = false,
  status = 200,
): Response {
  const accent = success
    ? "#57F287"
    : "#ED4245";

  const icon = success
    ? "✓"
    : "✕";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >
  <title>${escapeHtml(title)}</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;

      background:
        radial-gradient(
          circle at top,
          #172554,
          #080B12 55%
        );

      color: #F2F3F5;

      font-family:
        Inter,
        Arial,
        Helvetica,
        sans-serif;
    }

    .card {
      width: 100%;
      max-width: 560px;

      padding: 38px;

      background: #11141C;

      border: 1px solid #252936;
      border-radius: 18px;

      box-shadow:
        0 20px 60px
        rgba(0, 0, 0, 0.45);

      text-align: center;
    }

    .icon {
      width: 64px;
      height: 64px;

      margin:
        0 auto
        22px auto;

      display: flex;
      align-items: center;
      justify-content: center;

      border-radius: 50%;

      background: ${accent};
      color: #0A0C11;

      font-size: 34px;
      font-weight: 900;
    }

    h1 {
      margin:
        0 0
        14px 0;

      font-size: 28px;
    }

    p {
      margin: 0;

      color: #B5BAC1;

      font-size: 16px;
      line-height: 1.6;
    }

    .brand {
      margin-top: 30px;

      color: #72767D;

      font-size: 13px;
    }
  </style>
</head>

<body>
  <main class="card">
    <div class="icon">
      ${icon}
    </div>

    <h1>
      ${escapeHtml(title)}
    </h1>

    <p>
      ${escapeHtml(message)}
    </p>

    <div class="brand">
      TGAR Core • Verification System
    </div>
  </main>
</body>
</html>
`;

  return new Response(
    html,
    {
      status,
      headers: {
        "content-type":
          "text/html; charset=utf-8",

        "cache-control":
          "no-store",
      },
    },
  );
}


function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function base64UrlToBytes(
  value: string,
): Uint8Array {
  let normalized = value
    .replaceAll("-", "+")
    .replaceAll("_", "/");

  while (
    normalized.length % 4 !== 0
  ) {
    normalized += "=";
  }

  const decoded = atob(
    normalized,
  );

  return Uint8Array.from(
    decoded,
    (character) =>
      character.charCodeAt(0),
  );
}


function decodeBase64UrlText(
  value: string,
): string {
  return new TextDecoder().decode(
    base64UrlToBytes(
      value,
    ),
  );
}


async function getStateKey():
  Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",

    new TextEncoder().encode(
      STATE_SECRET,
    ),

    {
      name: "HMAC",
      hash: "SHA-256",
    },

    false,

    [
      "verify",
    ],
  );
}


async function verifyState(
  stateValue: string,
): Promise<VerificationState | null> {
  const parts =
    stateValue.split(".");

  if (
    parts.length !== 2
  ) {
    return null;
  }

  const [
    payloadPart,
    signaturePart,
  ] = parts;

  let signatureBytes:
    Uint8Array;

  try {
    signatureBytes =
      base64UrlToBytes(
        signaturePart,
      );
  } catch {
    return null;
  }

  const key =
    await getStateKey();

  const validSignature =
    await crypto.subtle.verify(
      "HMAC",

      key,

      signatureBytes,

      new TextEncoder().encode(
        payloadPart,
      ),
    );

  if (!validSignature) {
    return null;
  }

  let state:
    VerificationState;

  try {
    state = JSON.parse(
      decodeBase64UrlText(
        payloadPart,
      ),
    );
  } catch {
    return null;
  }

  if (
    typeof state.discord_user_id
      !== "string"
    ||
    typeof state.channel_id
      !== "string"
    ||
    typeof state.exp
      !== "number"
    ||
    typeof state.nonce
      !== "string"
  ) {
    return null;
  }

  const currentTime =
    Math.floor(
      Date.now() / 1000,
    );

  if (
    state.exp < currentTime
  ) {
    return null;
  }

  if (
    state.channel_id
      !== VERIFICATION_CHANNEL_ID
  ) {
    return null;
  }

  return state;
}


async function exchangeRobloxCode(
  code: string,
): Promise<string> {
  const body =
    new URLSearchParams();

  body.set(
    "client_id",
    ROBLOX_CLIENT_ID,
  );

  body.set(
    "client_secret",
    ROBLOX_CLIENT_SECRET,
  );

  body.set(
    "grant_type",
    "authorization_code",
  );

  body.set(
    "code",
    code,
  );

  const response =
    await fetch(
      ROBLOX_TOKEN_URL,
      {
        method: "POST",

        headers: {
          "content-type":
            "application/x-www-form-urlencoded",
        },

        body,
      },
    );

  if (!response.ok) {
    const errorText =
      await response.text();

    console.error(
      "Roblox token exchange failed:",
      response.status,
      errorText,
    );

    throw new Error(
      "Roblox authorization code could not be exchanged.",
    );
  }

  const data =
    await response.json();

  const accessToken =
    data.access_token;

  if (
    typeof accessToken
      !== "string"
    ||
    !accessToken
  ) {
    throw new Error(
      "Roblox did not return an access token.",
    );
  }

  return accessToken;
}


async function getRobloxUser(
  accessToken: string,
): Promise<RobloxUserInfo> {
  const response =
    await fetch(
      ROBLOX_USERINFO_URL,
      {
        headers: {
          authorization:
            `Bearer ${accessToken}`,
        },
      },
    );

  if (!response.ok) {
    const errorText =
      await response.text();

    console.error(
      "Roblox userinfo failed:",
      response.status,
      errorText,
    );

    throw new Error(
      "Roblox account information could not be loaded.",
    );
  }

  const data =
    await response.json();

  if (
    typeof data.sub
      !== "string"
  ) {
    throw new Error(
      "Roblox returned an invalid user ID.",
    );
  }

  return data;
}


async function getRobloxGroupMembership(
  robloxUserId: string,
): Promise<RobloxGroupRole | null> {
  const url =
    `https://groups.roblox.com/v1/users/${
      encodeURIComponent(
        robloxUserId,
      )
    }/groups/roles`;

  const response =
    await fetch(
      url,
      {
        headers: {
          accept:
            "application/json",
        },
      },
    );

  if (!response.ok) {
    const errorText =
      await response.text();

    console.error(
      "Roblox group lookup failed:",
      response.status,
      errorText,
    );

    throw new Error(
      "TGAR group membership could not be checked.",
    );
  }

  const data =
    await response.json();

  if (
    !Array.isArray(
      data.data,
    )
  ) {
    return null;
  }

  const targetGroupId =
    Number(
      TGAR_GROUP_ID,
    );

  const membership =
    data.data.find(
      (
        entry:
          RobloxGroupRole,
      ) =>
        Number(
          entry?.group?.id,
        )
          === targetGroupId,
    );

  return membership ?? null;
}


function discordHeaders():
  HeadersInit {
  return {
    authorization:
      `Bot ${DISCORD_BOT_TOKEN}`,

    "content-type":
      "application/json",

    "x-audit-log-reason":
      encodeURIComponent(
        "TGAR Core Roblox Verification",
      ),
  };
}


async function discordRequest(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers =
    new Headers(
      discordHeaders(),
    );

  if (options.headers) {
    const extraHeaders =
      new Headers(
        options.headers,
      );

    for (
      const [
        key,
        value,
      ] of extraHeaders
    ) {
      headers.set(
        key,
        value,
      );
    }
  }

  return await fetch(
    `${DISCORD_API}${path}`,
    {
      ...options,
      headers,
    },
  );
}


async function getDiscordMember(
  discordUserId: string,
): Promise<DiscordMember> {
  const response =
    await discordRequest(
      `/guilds/${
        DISCORD_GUILD_ID
      }/members/${
        discordUserId
      }`,
    );

  if (!response.ok) {
    throw new Error(
      "Your Discord membership could not be found.",
    );
  }

  return await response.json();
}


async function getDiscordRoles():
  Promise<DiscordRole[]> {
  const response =
    await discordRequest(
      `/guilds/${
        DISCORD_GUILD_ID
      }/roles`,
    );

  if (!response.ok) {
    throw new Error(
      "Discord roles could not be loaded.",
    );
  }

  return await response.json();
}


async function addDiscordRole(
  discordUserId: string,
  roleId: string,
): Promise<void> {
  const response =
    await discordRequest(
      `/guilds/${
        DISCORD_GUILD_ID
      }/members/${
        discordUserId
      }/roles/${
        roleId
      }`,

      {
        method: "PUT",
      },
    );

  if (
    !response.ok
    &&
    response.status !== 204
  ) {
    const errorText =
      await response.text();

    console.error(
      `Failed to add role ${roleId}:`,
      response.status,
      errorText,
    );

    throw new Error(
      "One or more required Discord roles could not be added.",
    );
  }
}


async function removeDiscordRole(
  discordUserId: string,
  roleId: string,
): Promise<boolean> {
  const response =
    await discordRequest(
      `/guilds/${
        DISCORD_GUILD_ID
      }/members/${
        discordUserId
      }/roles/${
        roleId
      }`,

      {
        method: "DELETE",
      },
    );

  if (
    response.ok
    ||
    response.status === 204
  ) {
    return true;
  }

  const errorText =
    await response.text();

  console.warn(
    `Could not remove role ${roleId}:`,
    response.status,
    errorText,
  );

  return false;
}


async function setDiscordNickname(
  discordUserId: string,
  nickname: string,
): Promise<void> {
  const safeNickname =
    nickname.slice(
      0,
      32,
    );

  const response =
    await discordRequest(
      `/guilds/${
        DISCORD_GUILD_ID
      }/members/${
        discordUserId
      }`,

      {
        method: "PATCH",

        body: JSON.stringify(
          {
            nick:
              safeNickname,
          },
        ),
      },
    );

  if (!response.ok) {
    const errorText =
      await response.text();

    console.error(
      "Nickname update failed:",
      response.status,
      errorText,
    );

    throw new Error(
      "Your Discord nickname could not be updated.",
    );
  }
}


async function updateDiscordRoles(
  discordUserId: string,
  member: DiscordMember,
): Promise<void> {
  const guildRoles =
    await getDiscordRoles();

  const roleById =
    new Map(
      guildRoles.map(
        (role) => [
          role.id,
          role,
        ],
      ),
    );

  const desiredRoles =
    new Set(
      VERIFICATION_ROLE_IDS,
    );

  for (
    const currentRoleId
    of member.roles
  ) {
    if (
      desiredRoles.has(
        currentRoleId,
      )
    ) {
      continue;
    }

    const role =
      roleById.get(
        currentRoleId,
      );

    if (!role) {
      continue;
    }

    // Discord-managed roles cannot be manually removed.
    if (role.managed) {
      continue;
    }

    await removeDiscordRole(
      discordUserId,
      currentRoleId,
    );
  }

  for (
    const roleId
    of VERIFICATION_ROLE_IDS
  ) {
    await addDiscordRole(
      discordUserId,
      roleId,
    );
  }

  // Explicitly ensure Unverified is removed.
  await removeDiscordRole(
    discordUserId,
    UNVERIFIED_ROLE_ID,
  );
}


async function handleCallback(
  request: Request,
): Promise<Response> {
  const url =
    new URL(
      request.url,
    );

  const oauthError =
    url.searchParams.get(
      "error",
    );

  if (oauthError) {
    return htmlResponse(
      "Verification Cancelled",
      "Roblox authorization was cancelled or denied. You may return to Discord and run /verify again.",
      false,
      400,
    );
  }

  const code =
    url.searchParams.get(
      "code",
    );

  const stateValue =
    url.searchParams.get(
      "state",
    );

  if (
    !code
    ||
    !stateValue
  ) {
    return htmlResponse(
      "Invalid Verification",
      "The verification request is missing required information. Please return to Discord and run /verify again.",
      false,
      400,
    );
  }

  const state =
    await verifyState(
      stateValue,
    );

  if (!state) {
    return htmlResponse(
      "Verification Expired",
      "This verification link is invalid or has expired. Please return to Discord and run /verify again.",
      false,
      400,
    );
  }

  try {
    const discordMember =
      await getDiscordMember(
        state.discord_user_id,
      );

    if (
      !discordMember.roles.includes(
        UNVERIFIED_ROLE_ID,
      )
    ) {
      return htmlResponse(
        "Already Verified",
        "Your Discord account is no longer marked as Unverified.",
        false,
        409,
      );
    }

    const accessToken =
      await exchangeRobloxCode(
        code,
      );

    const robloxUser =
      await getRobloxUser(
        accessToken,
      );

    const membership =
      await getRobloxGroupMembership(
        robloxUser.sub,
      );

    if (!membership) {
      return htmlResponse(
        "TGAR Membership Required",
        "Your Roblox account is not currently a member of the Grand Army TGAR group. Join the group first, then return to Discord and run /verify again.",
        false,
        403,
      );
    }

    const robloxUsername =
      robloxUser.preferred_username
      ?? robloxUser.nickname
      ?? robloxUser.name;

    if (!robloxUsername) {
      throw new Error(
        "Roblox did not provide a username.",
      );
    }

    await updateDiscordRoles(
      state.discord_user_id,
      discordMember,
    );

    await setDiscordNickname(
      state.discord_user_id,
      robloxUsername,
    );

    console.log(
      "Verification completed:",
      {
        discordUserId:
          state.discord_user_id,

        robloxUserId:
          robloxUser.sub,

        robloxUsername,

        tgarRole:
          membership.role?.name
          ?? "Unknown",
      },
    );

    return htmlResponse(
      "Verification Complete",
      `Successfully verified as ${robloxUsername}. Your Discord roles and nickname have been updated. You may now return to Discord.`,
      true,
      200,
    );
  } catch (error) {
    console.error(
      "Verification failed:",
      error,
    );

    return htmlResponse(
      "Verification Failed",
      "TGAR Core could not complete your verification. Please return to Discord and try again. If the problem continues, contact a staff member.",
      false,
      500,
    );
  }
}


Deno.serve(
  async (
    request: Request,
  ): Promise<Response> => {
    const url =
      new URL(
        request.url,
      );

    if (
      request.method === "GET"
      &&
      url.pathname === "/callback"
    ) {
      return await handleCallback(
        request,
      );
    }

    if (
      request.method === "GET"
      &&
      url.pathname === "/health"
    ) {
      return new Response(
        JSON.stringify(
          {
            status: "ok",
            service:
              "TGAR Core Verification",
          },
        ),

        {
          status: 200,

          headers: {
            "content-type":
              "application/json; charset=utf-8",

            "cache-control":
              "no-store",
          },
        },
      );
    }

    return htmlResponse(
      "TGAR Core Verification",
      "This service handles secure Roblox verification for TGAR Core. Verification must be started through /verify in the TGAR Discord server.",
      true,
      200,
    );
  },
);
