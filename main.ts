// ============================================================
// TGAR CORE — ROBLOX VERIFICATION SERVICE
// ============================================================


// ------------------------------------------------------------
// Environment variables
// ------------------------------------------------------------

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

const STATE_SECRET = requireEnv(
  "STATE_SECRET",
);

const SYNC_API_SECRET = requireEnv(
  "SYNC_API_SECRET",
);

const ARREST_API_SECRET = requireEnv(
  "ARREST_API_SECRET",
);


// ------------------------------------------------------------
// Verification roles
// ------------------------------------------------------------

// These roles are given to every successfully verified
// Enlisted TGAR member.

const VERIFIED_ENLISTED_BASE_ROLE_IDS = [
  "1470567885448413265", // Verified
  "1470567885448413267", // Grand Army of the Republic
  "1470567885448413269", // Basic
  "1470567885486293214", // Enlisted
  "1470567885427708119", // pings
  "1531335965287649452", // Community Ping
  "1470567885427708118", // Tryout Ping
  "1533839167878987816", // Events Ping
  "1547020811146363010", // Content Ping
];


// ------------------------------------------------------------
// Exact Roblox rank -> Discord role mapping
// ------------------------------------------------------------

// IMPORTANT:
//
// There is deliberately NO fallback.
//
// A Roblox rank must exactly match one of the names below.
// Otherwise verification stops before Discord roles are changed.

const ROBLOX_ENLISTED_RANK_ROLES:
  Record<string, string> = {

  "Cadet":
    "1470567885448413270",

  "Trooper":
    "1470567885448413271",

  "Specialist":
    "1470567885448413272",

  "Lance Corporal":
    "1470567885448413273",

  "Corporal":
    "1470567885448413274",

  "Sergeant":
    "1470567885478035597",

  "Staff Sergeant":
    "1470567885478035600",

  "Sergeant First Class":
    "1470567885478035598",

  "Master Sergeant":
    "1470567885478035601",

  "Sergeant Major":
    "1547023213362417674",

  "Command Sergeant Major":
    "1470567885478035602",

  "Warrant Officer":
    "1470567885478035604",

  "Upper Warrant Officer":
    "1470567885478035605",

  "Chief Warrant Officer":
    "1470567885478035606",
};


// ------------------------------------------------------------
// API endpoints
// ------------------------------------------------------------

const ROBLOX_TOKEN_URL =
  "https://apis.roblox.com/oauth/v1/token";

const ROBLOX_USERINFO_URL =
  "https://apis.roblox.com/oauth/v1/userinfo";

const DISCORD_API =
  "https://discord.com/api/v10";


// ============================================================
// Types
// ============================================================

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


// ============================================================
// Environment helper
// ============================================================

function requireEnv(
  name: string,
): string {

  const value =
    Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
}


// ============================================================
// Deno KV — verified account storage
// ============================================================

const kv = await Deno.openKv();

interface VerifiedUserRecord {
  discordUserId: string;
  robloxUserId: string;
  robloxUsername: string;
  tgarRank: string;
  verifiedAt: string;
  updatedAt: string;
}

async function saveVerifiedUser(
  discordUserId: string,
  robloxUserId: string,
  robloxUsername: string,
  tgarRank: string,
): Promise<void> {
  const now = new Date().toISOString();

  const existing =
    await kv.get<VerifiedUserRecord>(
      ["verified_users", discordUserId],
    );

  const record: VerifiedUserRecord = {
    discordUserId,
    robloxUserId,
    robloxUsername,
    tgarRank,
    verifiedAt:
      existing.value?.verifiedAt ?? now,
    updatedAt: now,
  };

  const result = await kv.set(
    ["verified_users", discordUserId],
    record,
  );

  if (!result.ok) {
    throw new Error(
      "Verified account mapping could not be saved.",
    );
  }

  console.log(
    "Verified account mapping saved:",
    {
      discordUserId,
      robloxUserId,
      robloxUsername,
      tgarRank,
    },
  );
}


// ============================================================
// HTML response
// ============================================================

function htmlResponse(
  title: string,
  message: string,
  success = false,
  status = 200,
): Response {

  const accent =
    success
      ? "#57F287"
      : "#ED4245";

  const icon =
    success
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

  border:
    1px solid #252936;

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


// ============================================================
// HTML escaping
// ============================================================

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


// ============================================================
// Base64 URL decoding
// ============================================================

function base64UrlToBytes(
  value: string,
): Uint8Array {

  let normalized =
    value
      .replaceAll("-", "+")
      .replaceAll("_", "/");

  while (
    normalized.length % 4 !== 0
  ) {
    normalized += "=";
  }

  const decoded =
    atob(normalized);

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


// ============================================================
// State verification
// ============================================================

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

    state =
      JSON.parse(
        decodeBase64UrlText(
          payloadPart,
        ),
      );

  } catch {

    return null;
  }


  if (
    typeof state.discord_user_id !== "string"
    ||
    typeof state.channel_id !== "string"
    ||
    typeof state.exp !== "number"
    ||
    typeof state.nonce !== "string"
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


// ============================================================
// Roblox OAuth
// ============================================================

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


  body.set(
    "redirect_uri",
    ROBLOX_REDIRECT_URI,
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
    typeof accessToken !== "string"
    ||
    !accessToken
  ) {

    throw new Error(
      "Roblox did not return an access token.",
    );
  }


  return accessToken;
}


// ============================================================
// Roblox user
// ============================================================

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
    typeof data.sub !== "string"
  ) {

    throw new Error(
      "Roblox returned an invalid user ID.",
    );
  }


  return data;
}


// ============================================================
// Roblox TGAR membership
// ============================================================

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


// ============================================================
// Exact Enlisted rank mapping
// ============================================================

function getDiscordRankRoleId(
  robloxRankName: string,
): string | null {

  return (
    ROBLOX_ENLISTED_RANK_ROLES[
      robloxRankName
    ]
    ?? null
  );
}


// ============================================================
// Discord API
// ============================================================

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


// ============================================================
// Discord member lookup
// ============================================================

async function getDiscordMember(
  discordUserId: string,
): Promise<DiscordMember> {

  console.log(
    "Discord member lookup started:",
    {
      guildId:
        DISCORD_GUILD_ID,

      discordUserId,
    },
  );


  const response =
    await discordRequest(
      `/guilds/${
        DISCORD_GUILD_ID
      }/members/${
        discordUserId
      }`,
    );


  if (!response.ok) {

    const errorText =
      await response.text();


    console.error(
      "Discord member lookup failed:",
      {
        status:
          response.status,

        statusText:
          response.statusText,

        guildId:
          DISCORD_GUILD_ID,

        discordUserId,

        response:
          errorText,
      },
    );


    if (
      response.status === 401
    ) {

      throw new Error(
        "Discord rejected the bot token.",
      );
    }


    if (
      response.status === 403
    ) {

      throw new Error(
        "TGAR Core does not have permission to access this Discord server.",
      );
    }


    if (
      response.status === 404
    ) {

      throw new Error(
        "Discord could not find the configured server or member.",
      );
    }


    throw new Error(
      `Discord member lookup failed with HTTP ${response.status}.`,
    );
  }


  const member =
    await response.json();


  console.log(
    "Discord member found:",
    {
      discordUserId,

      username:
        member?.user?.username
        ?? "Unknown",

      roles:
        member?.roles
        ?? [],
    },
  );


  return member;
}


// ============================================================
// Discord roles
// ============================================================

async function getDiscordRoles():
  Promise<DiscordRole[]> {

  const response =
    await discordRequest(
      `/guilds/${
        DISCORD_GUILD_ID
      }/roles`,
    );


  if (!response.ok) {

    const errorText =
      await response.text();


    console.error(
      "Discord role lookup failed:",
      response.status,
      errorText,
    );


    throw new Error(
      "Discord roles could not be loaded.",
    );
  }


  return await response.json();
}


// ============================================================
// Discord rate-limit handling
// ============================================================

async function discordRequestWithRetry(
  path: string,
  options: RequestInit = {},
  maxRetries = 3,
): Promise<Response> {

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await discordRequest(path, options);

    if (response.status !== 429) {
      return response;
    }

    let retryAfterSeconds = 1;

    try {
      const data = await response.clone().json();

      if (
        typeof data?.retry_after === "number"
        && Number.isFinite(data.retry_after)
      ) {
        retryAfterSeconds = data.retry_after;
      }
    } catch {
      const retryAfterHeader = response.headers.get("retry-after");
      const parsedRetryAfter = Number(retryAfterHeader);

      if (
        Number.isFinite(parsedRetryAfter)
        && parsedRetryAfter > 0
      ) {
        retryAfterSeconds = parsedRetryAfter;
      }
    }

    if (attempt >= maxRetries) {
      return response;
    }

    const waitMilliseconds =
      Math.ceil(retryAfterSeconds * 1000) + 250;

    console.warn(
      "Discord rate limit received. Retrying request:",
      {
        path,
        attempt: attempt + 1,
        retryAfterSeconds,
      },
    );

    await sleep(waitMilliseconds);
  }

  throw new Error(
    "Discord request retry loop ended unexpectedly.",
  );
}


// ============================================================
// Update Discord member
// ============================================================

async function updateDiscordMember(
  discordUserId: string,
  member: DiscordMember,
  rankRoleId: string,
  nickname: string,
): Promise<void> {

  const guildRoles = await getDiscordRoles();

  const roleById = new Map(
    guildRoles.map(
      (role) => [
        role.id,
        role,
      ],
    ),
  );

  const desiredRoles = new Set<string>(
    [
      ...VERIFIED_ENLISTED_BASE_ROLE_IDS,
      rankRoleId,
    ],
  );

  // Keep only Discord-managed/integration roles from the member's
  // existing roles. All normal old roles are intentionally cleared.
  const preservedManagedRoles =
    member.roles.filter(
      (currentRoleId) => {
        const role = roleById.get(currentRoleId);
        return role?.managed === true;
      },
    );

  const finalRoles = Array.from(
    new Set<string>(
      [
        ...preservedManagedRoles,
        ...desiredRoles,
      ],
    ),
  );

  const safeNickname = nickname.slice(0, 32);

  console.log(
    "Applying Discord member update:",
    {
      discordUserId,
      preservedManagedRoles,
      desiredRoles: Array.from(desiredRoles),
      finalRoles,
      nickname: safeNickname,
    },
  );

  // One Discord PATCH sets the final role list and nickname together.
  const response = await discordRequestWithRetry(
    `/guilds/${DISCORD_GUILD_ID}/members/${discordUserId}`,
    {
      method: "PATCH",
      body: JSON.stringify(
        {
          roles: finalRoles,
          nick: safeNickname,
        },
      ),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    console.error(
      "Discord member update failed:",
      response.status,
      errorText,
    );

    if (response.status === 429) {
      throw new Error(
        "Discord continued rate limiting the verification request after retries.",
      );
    }

    if (response.status === 403) {
      throw new Error(
        "TGAR Core does not have permission to update the required Discord roles or nickname.",
      );
    }

    throw new Error(
      `Discord member update failed with HTTP ${response.status}.`,
    );
  }

  console.log(
    "Discord member update completed.",
    {
      discordUserId,
      roleCount: finalRoles.length,
      nickname: safeNickname,
    },
  );
}


// ============================================================
// Delay helper
// ============================================================

function sleep(
  milliseconds: number,
): Promise<void> {

  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds,
      ),
  );
}


// ============================================================
// Roblox callback
// ============================================================

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


  console.log(
    "Verification callback received:",
    {
      discordUserId:
        state.discord_user_id,

      channelId:
        state.channel_id,
    },
  );


  try {

    // --------------------------------------------------------
    // Discord member
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // Exchange Roblox OAuth code
    // --------------------------------------------------------

    const accessToken =
      await exchangeRobloxCode(
        code,
      );


    // --------------------------------------------------------
    // Get Roblox user
    // --------------------------------------------------------

    const robloxUser =
      await getRobloxUser(
        accessToken,
      );


    console.log(
      "Roblox user loaded:",
      {
        robloxUserId:
          robloxUser.sub,

        username:
          robloxUser.preferred_username
          ?? robloxUser.nickname
          ?? robloxUser.name
          ?? "Unknown",
      },
    );


    // --------------------------------------------------------
    // Check TGAR membership
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // Exact TGAR rank
    // --------------------------------------------------------

    const robloxRank =
      membership.role?.name?.trim();


    if (!robloxRank) {

      throw new Error(
        "Roblox did not provide a valid TGAR rank.",
      );
    }


    const rankRoleId =
      getDiscordRankRoleId(
        robloxRank,
      );


    // --------------------------------------------------------
    // Roblox username
    // --------------------------------------------------------

    const robloxUsername =
      robloxUser.preferred_username
      ?? robloxUser.nickname
      ?? robloxUser.name;


    if (!robloxUsername) {

      throw new Error(
        "Roblox did not provide a username.",
      );
    }


    // --------------------------------------------------------
    // Non-Enlisted TGAR member
    //
    // Link and store the account, but do not rank or rename
    // the Discord member. This allows division autosync to
    // recognize Officers/HICOM and other TGAR ranks.
    // --------------------------------------------------------

    if (!rankRoleId) {

      console.log(
        "Non-Enlisted TGAR account linked:",
        {
          discordUserId:
            state.discord_user_id,

          robloxUserId:
            robloxUser.sub,

          robloxUsername,

          tgarRole:
            robloxRank,
        },
      );


      await saveVerifiedUser(
        state.discord_user_id,
        robloxUser.sub,
        robloxUsername,
        robloxRank,
      );


      return htmlResponse(
        "Account Linked",
        `Successfully linked ${robloxUsername} with the TGAR rank ${robloxRank}. Because this is not a supported Enlisted rank, TGAR Core has not changed your Discord rank or nickname. Your linked account can still be used for division synchronization. You may now return to Discord.`,
        true,
        200,
      );
    }


    console.log(
      "Roblox verification successful:",
      {
        robloxUsername,

        robloxUserId:
          robloxUser.sub,

        tgarRole:
          robloxRank,

        discordRankRoleId:
          rankRoleId,
      },
    );


    // --------------------------------------------------------
    // Wait before changing Discord account
    // --------------------------------------------------------

    console.log(
      "Waiting 10 seconds before applying Discord verification...",
    );


    await sleep(
      10_000,
    );


    // --------------------------------------------------------
    // Discord roles + nickname
    // --------------------------------------------------------

    console.log(
      "Updating Discord roles and nickname...",
    );


    await updateDiscordMember(
      state.discord_user_id,
      discordMember,
      rankRoleId,
      robloxUsername,
    );


    // --------------------------------------------------------
    // Persist verified Discord <-> Roblox account mapping
    // --------------------------------------------------------

    await saveVerifiedUser(
      state.discord_user_id,
      robloxUser.sub,
      robloxUsername,
      robloxRank,
    );


    // --------------------------------------------------------
    // Complete
    // --------------------------------------------------------

    console.log(
      "Verification completed:",
      {
        discordUserId:
          state.discord_user_id,

        robloxUserId:
          robloxUser.sub,

        robloxUsername,

        tgarRole:
          robloxRank,

        discordRankRoleId:
          rankRoleId,
      },
    );


    return htmlResponse(
      "Verification Complete",
      `Successfully verified as ${robloxUsername} with the TGAR rank ${robloxRank}. Your Discord roles and nickname have been updated. You may now return to Discord.`,
      true,
      200,
    );

  } catch (error) {

    console.error(
      "Verification failed:",
      error,
    );


    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error);


    console.error(
      "Verification failure details:",
      {
        discordUserId:
          state.discord_user_id,

        guildId:
          DISCORD_GUILD_ID,

        channelId:
          state.channel_id,

        error:
          errorMessage,
      },
    );


    return htmlResponse(
      "Verification Failed",
      "TGAR Core could not complete your verification. Please return to Discord and try again. If the problem continues, contact a staff member.",
      false,
      500,
    );
  }
}


// ============================================================
// Secured sync API
// ============================================================

function constantTimeEqual(
  left: string,
  right: string,
): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);

  const length = Math.max(
    leftBytes.length,
    rightBytes.length,
  );

  let difference =
    leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index++) {
    difference |=
      (leftBytes[index] ?? 0)
      ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}


function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "content-type":
          "application/json; charset=utf-8",
        "cache-control":
          "no-store",
      },
    },
  );
}


async function handleSyncUsers(
  request: Request,
): Promise<Response> {
  const authorization =
    request.headers.get("authorization") ?? "";

  const expectedAuthorization =
    `Bearer ${SYNC_API_SECRET}`;

  if (
    !constantTimeEqual(
      authorization,
      expectedAuthorization,
    )
  ) {
    return jsonResponse(
      {
        error: "Unauthorized",
      },
      401,
    );
  }

  const users: VerifiedUserRecord[] = [];

  const entries =
    kv.list<VerifiedUserRecord>(
      {
        prefix: ["verified_users"],
      },
    );

  for await (const entry of entries) {
    if (
      entry.value
      && typeof entry.value.discordUserId === "string"
      && typeof entry.value.robloxUserId === "string"
    ) {
      users.push(entry.value);
    }
  }

  console.log(
    "Authorized sync user list requested:",
    {
      count: users.length,
    },
  );

  return jsonResponse(
    {
      users,
      count: users.length,
    },
    200,
  );
}


// ============================================================
// Secured Roblox arrest API
// ============================================================

interface PendingArrestRecord {
  arrestId: string;
  jailerRobloxUserId: string;
  jailerUsername: string;
  offenderRobloxUserId: string;
  offenderUsername: string;
  reason: string;
  duration: number;
  morphDivision: string;
  morphName: string;
  route: "CG" | "RI" | "GAR";
  status: "pending" | "claimed" | "awaiting_proof" | "completed" | "expired";
  createdAt: string;
  expiresAt: string;
  claimedAt?: string;
  claimExpiresAt?: string;
  dispatchedAt?: string;
  proofRequestDiscordMessageId?: string;
  proofRequestDiscordChannelId?: string;
  completedAt?: string;
  logDiscordMessageId?: string;
  logDiscordChannelId?: string;
  logMessageUrl?: string;
  expiredAt?: string;
  expirationAlertClaimedAt?: string;
  expirationAlertClaimExpiresAt?: string;
  expirationAlertedAt?: string;
}

const ARREST_CLAIM_LEASE_MS = 2 * 60 * 1000;
const EXPIRATION_ALERT_CLAIM_LEASE_MS = 2 * 60 * 1000;

function arrestString(value: unknown, name: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim().slice(0, max);
}

function optionalArrestString(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const result = value.trim().slice(0, max);
  return result || undefined;
}

function arrestUserId(value: unknown, name: string): string {
  const result =
    typeof value === "number"
      ? String(Math.trunc(value))
      : typeof value === "string"
        ? value.trim()
        : "";

  // Real Roblox user IDs are positive integers.
  // Roblox Studio's multi-client test players use negative IDs
  // such as -1 and -2, so allow those for development/testing.
  if (!/^-?\d+$/.test(result) || result === "0") {
    throw new Error(`${name} is invalid.`);
  }

  return result;
}

function getArrestRoute(morphDivision: string): "CG" | "RI" | "GAR" {
  const division = morphDivision.trim().toLowerCase();
  if (division === "coruscant guard") return "CG";
  if (division === "republic intelligence") return "RI";
  return "GAR";
}

function isSyncAuthorized(request: Request): boolean {
  const authorization = request.headers.get("authorization") ?? "";
  return constantTimeEqual(authorization, `Bearer ${SYNC_API_SECRET}`);
}

function arrestIdFromPath(pathname: string, action: string): string | null {
  const match = pathname.match(new RegExp(`^/arrests/([^/]+)/${action}$`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

async function readOptionalJsonObject(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) return {};
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid JSON body.");
  }
  return parsed as Record<string, unknown>;
}

async function handleCreateArrest(request: Request): Promise<Response> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!constantTimeEqual(authorization, `Bearer ${ARREST_API_SECRET}`)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: "Invalid JSON body." }, 400); }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: "Invalid arrest payload." }, 400);
  }

  try {
    const payload = body as Record<string, unknown>;
    const jailerRobloxUserId = arrestUserId(payload.jailerRobloxUserId, "jailerRobloxUserId");
    const jailerUsername = arrestString(payload.jailerUsername, "jailerUsername", 64);
    const offenderRobloxUserId = arrestUserId(payload.offenderRobloxUserId, "offenderRobloxUserId");
    const offenderUsername = arrestString(payload.offenderUsername, "offenderUsername", 64);
    const reason = arrestString(payload.reason, "reason", 500);
    const morphDivision = arrestString(payload.morphDivision, "morphDivision", 100);
    const morphName = typeof payload.morphName === "string" ? payload.morphName.trim().slice(0, 100) : "";
    const durationNumber = Number(payload.duration);
    if (!Number.isFinite(durationNumber) || durationNumber < 0 || durationNumber > 86400) throw new Error("duration is invalid.");

    const route = getArrestRoute(morphDivision);
    const arrestId = crypto.randomUUID();
    const created = new Date();
    const expires = new Date(created.getTime() + 1 * 60 * 1000);
    const record: PendingArrestRecord = {
      arrestId, jailerRobloxUserId, jailerUsername, offenderRobloxUserId, offenderUsername,
      reason, duration: Math.floor(durationNumber), morphDivision, morphName, route, status: "pending",
      createdAt: created.toISOString(), expiresAt: expires.toISOString(),
    };

    const result = await kv.set(["pending_arrests", arrestId], record);
    if (!result.ok) throw new Error("Pending arrest could not be saved.");
    console.log("Pending arrest received from Roblox:", { arrestId, jailerRobloxUserId, offenderRobloxUserId, route, morphDivision, morphName });
    return jsonResponse({ ok: true, arrestId, route, expiresAt: record.expiresAt }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid arrest payload.";
    console.warn("Rejected arrest payload:", message);
    return jsonResponse({ error: message }, 400);
  }
}

async function handlePendingArrests(request: Request): Promise<Response> {
  if (!isSyncAuthorized(request)) return jsonResponse({ error: "Unauthorized" }, 401);

  const now = Date.now();
  const arrests: PendingArrestRecord[] = [];
  for await (const entry of kv.list<PendingArrestRecord>({ prefix: ["pending_arrests"] })) {
    const arrest = entry.value;
    if (!arrest || Date.parse(arrest.expiresAt) <= now) continue;

    const claimExpired = arrest.status === "claimed" &&
      (!arrest.claimExpiresAt || Date.parse(arrest.claimExpiresAt) <= now);

    if (arrest.status === "pending" || claimExpired) arrests.push(arrest);
  }

  arrests.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return jsonResponse({ arrests, count: arrests.length }, 200);
}

async function handleAwaitingProofArrests(request: Request): Promise<Response> {
  if (!isSyncAuthorized(request)) return jsonResponse({ error: "Unauthorized" }, 401);

  const now = Date.now();
  const arrests: PendingArrestRecord[] = [];

  for await (const entry of kv.list<PendingArrestRecord>({ prefix: ["pending_arrests"] })) {
    const arrest = entry.value;

    if (!arrest) continue;
    if (arrest.status !== "awaiting_proof") continue;
    if (Date.parse(arrest.expiresAt) <= now) continue;

    // A usable awaiting-proof record must point back to the exact
    // Discord DM message that the jailer was instructed to reply to.
    if (!arrest.proofRequestDiscordMessageId) continue;
    if (!arrest.proofRequestDiscordChannelId) continue;

    arrests.push(arrest);
  }

  arrests.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  return jsonResponse(
    {
      arrests,
      count: arrests.length,
    },
    200,
  );
}


async function handleClaimArrest(request: Request, arrestId: string): Promise<Response> {
  if (!isSyncAuthorized(request)) return jsonResponse({ error: "Unauthorized" }, 401);

  const key: Deno.KvKey = ["pending_arrests", arrestId];
  const existing = await kv.get<PendingArrestRecord>(key);
  if (!existing.value) return jsonResponse({ error: "Arrest not found." }, 404);

  const now = new Date();
  const arrest = existing.value;
  if (Date.parse(arrest.expiresAt) <= now.getTime()) return jsonResponse({ error: "Arrest has expired." }, 410);
  if (arrest.status === "awaiting_proof" || arrest.status === "completed" || arrest.status === "expired") {
    return jsonResponse({ error: `Arrest is already ${arrest.status}.` }, 409);
  }
  if (arrest.status === "claimed" && arrest.claimExpiresAt && Date.parse(arrest.claimExpiresAt) > now.getTime()) {
    return jsonResponse({ error: "Arrest is already claimed." }, 409);
  }

  const updated: PendingArrestRecord = {
    ...arrest,
    status: "claimed",
    claimedAt: now.toISOString(),
    claimExpiresAt: new Date(now.getTime() + ARREST_CLAIM_LEASE_MS).toISOString(),
  };

  const committed = await kv.atomic().check(existing).set(key, updated).commit();
  if (!committed.ok) return jsonResponse({ error: "Arrest was claimed by another worker." }, 409);
  return jsonResponse({ ok: true, arrest: updated }, 200);
}

async function handleDispatchArrest(request: Request, arrestId: string): Promise<Response> {
  if (!isSyncAuthorized(request)) return jsonResponse({ error: "Unauthorized" }, 401);

  let payload: Record<string, unknown>;
  try { payload = await readOptionalJsonObject(request); }
  catch { return jsonResponse({ error: "Invalid JSON body." }, 400); }

  const key: Deno.KvKey = ["pending_arrests", arrestId];
  const existing = await kv.get<PendingArrestRecord>(key);
  if (!existing.value) return jsonResponse({ error: "Arrest not found." }, 404);

  const arrest = existing.value;
  if (arrest.status === "awaiting_proof") return jsonResponse({ ok: true, arrest }, 200);
  if (arrest.status !== "claimed") return jsonResponse({ error: `Arrest cannot be dispatched from status ${arrest.status}.` }, 409);

  const now = new Date();
  const updated: PendingArrestRecord = {
    ...arrest,
    status: "awaiting_proof",
    dispatchedAt: now.toISOString(),
    claimExpiresAt: undefined,
    proofRequestDiscordMessageId: optionalArrestString(payload.proofRequestDiscordMessageId, 32),
    proofRequestDiscordChannelId: optionalArrestString(payload.proofRequestDiscordChannelId, 32),
  };

  const committed = await kv.atomic().check(existing).set(key, updated).commit();
  if (!committed.ok) return jsonResponse({ error: "Arrest changed before dispatch could be saved." }, 409);
  return jsonResponse({ ok: true, arrest: updated }, 200);
}

async function handleCompleteArrest(request: Request, arrestId: string): Promise<Response> {
  if (!isSyncAuthorized(request)) return jsonResponse({ error: "Unauthorized" }, 401);

  let payload: Record<string, unknown>;
  try { payload = await readOptionalJsonObject(request); }
  catch { return jsonResponse({ error: "Invalid JSON body." }, 400); }

  const key: Deno.KvKey = ["pending_arrests", arrestId];
  const existing = await kv.get<PendingArrestRecord>(key);
  if (!existing.value) return jsonResponse({ error: "Arrest not found." }, 404);

  const arrest = existing.value;
  if (arrest.status === "completed") return jsonResponse({ ok: true, arrest }, 200);
  if (arrest.status !== "awaiting_proof") return jsonResponse({ error: `Arrest cannot be completed from status ${arrest.status}.` }, 409);
  if (Date.parse(arrest.expiresAt) <= Date.now()) return jsonResponse({ error: "Proof deadline has expired." }, 410);

  const updated: PendingArrestRecord = {
    ...arrest,
    status: "completed",
    completedAt: new Date().toISOString(),
    logDiscordMessageId: optionalArrestString(payload.logDiscordMessageId, 32),
    logDiscordChannelId: optionalArrestString(payload.logDiscordChannelId, 32),
    logMessageUrl: optionalArrestString(payload.logMessageUrl, 500),
  };

  const committed = await kv.atomic().check(existing).set(key, updated).commit();
  if (!committed.ok) return jsonResponse({ error: "Arrest changed before completion could be saved." }, 409);
  return jsonResponse({ ok: true, arrest: updated }, 200);
}

async function handleExpiredArrests(request: Request): Promise<Response> {
  if (!isSyncAuthorized(request)) return jsonResponse({ error: "Unauthorized" }, 401);

  const now = Date.now();
  const arrests: PendingArrestRecord[] = [];
  for await (const entry of kv.list<PendingArrestRecord>({ prefix: ["pending_arrests"] })) {
    const arrest = entry.value;
    // Only arrests whose proof request was actually dispatched are
    // eligible for a missed-proof alert. This avoids blaming a
    // jailer if Discord never received the original proof request.
    if (!arrest || arrest.status !== "awaiting_proof" || arrest.expirationAlertedAt) continue;
    if (Date.parse(arrest.expiresAt) > now) continue;

    const alertClaimAvailable = !arrest.expirationAlertClaimExpiresAt ||
      Date.parse(arrest.expirationAlertClaimExpiresAt) <= now;
    if (alertClaimAvailable) arrests.push(arrest);
  }

  arrests.sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
  return jsonResponse({ arrests, count: arrests.length }, 200);
}

async function handleClaimExpirationAlert(request: Request, arrestId: string): Promise<Response> {
  if (!isSyncAuthorized(request)) return jsonResponse({ error: "Unauthorized" }, 401);

  const key: Deno.KvKey = ["pending_arrests", arrestId];
  const existing = await kv.get<PendingArrestRecord>(key);
  if (!existing.value) return jsonResponse({ error: "Arrest not found." }, 404);

  const arrest = existing.value;
  const now = new Date();
  if (arrest.status === "completed") return jsonResponse({ error: "Arrest was completed." }, 409);
  if (Date.parse(arrest.expiresAt) > now.getTime()) return jsonResponse({ error: "Arrest has not expired yet." }, 409);
  if (arrest.expirationAlertedAt) return jsonResponse({ error: "Expiration alert was already sent." }, 409);
  if (arrest.expirationAlertClaimExpiresAt && Date.parse(arrest.expirationAlertClaimExpiresAt) > now.getTime()) {
    return jsonResponse({ error: "Expiration alert is already claimed." }, 409);
  }

  const updated: PendingArrestRecord = {
    ...arrest,
    status: "expired",
    expiredAt: arrest.expiredAt ?? now.toISOString(),
    expirationAlertClaimedAt: now.toISOString(),
    expirationAlertClaimExpiresAt: new Date(now.getTime() + EXPIRATION_ALERT_CLAIM_LEASE_MS).toISOString(),
  };

  const committed = await kv.atomic().check(existing).set(key, updated).commit();
  if (!committed.ok) return jsonResponse({ error: "Expiration alert was claimed by another worker." }, 409);
  return jsonResponse({ ok: true, arrest: updated }, 200);
}

async function handleMarkExpirationAlerted(request: Request, arrestId: string): Promise<Response> {
  if (!isSyncAuthorized(request)) return jsonResponse({ error: "Unauthorized" }, 401);

  const key: Deno.KvKey = ["pending_arrests", arrestId];
  const existing = await kv.get<PendingArrestRecord>(key);
  if (!existing.value) return jsonResponse({ error: "Arrest not found." }, 404);

  const arrest = existing.value;
  if (arrest.expirationAlertedAt) return jsonResponse({ ok: true, arrest }, 200);
  if (arrest.status !== "expired") return jsonResponse({ error: "Arrest is not in expired state." }, 409);

  const updated: PendingArrestRecord = {
    ...arrest,
    expirationAlertedAt: new Date().toISOString(),
    expirationAlertClaimExpiresAt: undefined,
  };

  const committed = await kv.atomic().check(existing).set(key, updated).commit();
  if (!committed.ok) return jsonResponse({ error: "Arrest changed before alert status could be saved." }, 409);
  return jsonResponse({ ok: true, arrest: updated }, 200);
}


// ============================================================
// HTTP server
// ============================================================

Deno.serve(

  async (
    request: Request,
  ): Promise<Response> => {

    const url =
      new URL(
        request.url,
      );


    // --------------------------------------------------------
    // Roblox OAuth callback
    // --------------------------------------------------------

    if (
      request.method === "GET"
      &&
      url.pathname === "/callback"
    ) {

      return await handleCallback(
        request,
      );
    }


    // --------------------------------------------------------
    // Secured verified-user sync API
    // --------------------------------------------------------

    if (
      request.method === "GET"
      &&
      url.pathname === "/sync/users"
    ) {

      return await handleSyncUsers(
        request,
      );
    }


    // --------------------------------------------------------
    // Secured Roblox arrest API
    // --------------------------------------------------------

    if (
      request.method === "POST"
      &&
      url.pathname === "/arrests"
    ) {
      return await handleCreateArrest(request);
    }


    // --------------------------------------------------------
    // Secured Discord arrest queue API
    // --------------------------------------------------------

    if (request.method === "GET" && url.pathname === "/arrests/pending") {
      return await handlePendingArrests(request);
    }

    if (request.method === "GET" && url.pathname === "/arrests/awaiting-proof") {
      return await handleAwaitingProofArrests(request);
    }

    if (request.method === "GET" && url.pathname === "/arrests/expired") {
      return await handleExpiredArrests(request);
    }

    const claimArrestId = arrestIdFromPath(url.pathname, "claim");
    if (request.method === "POST" && claimArrestId) {
      return await handleClaimArrest(request, claimArrestId);
    }

    const dispatchArrestId = arrestIdFromPath(url.pathname, "dispatch");
    if (request.method === "POST" && dispatchArrestId) {
      return await handleDispatchArrest(request, dispatchArrestId);
    }

    const completeArrestId = arrestIdFromPath(url.pathname, "complete");
    if (request.method === "POST" && completeArrestId) {
      return await handleCompleteArrest(request, completeArrestId);
    }

    const claimExpirationId = arrestIdFromPath(url.pathname, "expiration-alert/claim");
    if (request.method === "POST" && claimExpirationId) {
      return await handleClaimExpirationAlert(request, claimExpirationId);
    }

    const markExpirationId = arrestIdFromPath(url.pathname, "expiration-alert/sent");
    if (request.method === "POST" && markExpirationId) {
      return await handleMarkExpirationAlerted(request, markExpirationId);
    }


    // --------------------------------------------------------
    // Health check
    // --------------------------------------------------------

    if (
      request.method === "GET"
      &&
      url.pathname === "/health"
    ) {

      return new Response(
        JSON.stringify(
          {
            status:
              "ok",

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


    // --------------------------------------------------------
    // Privacy Policy
    // --------------------------------------------------------

    if (
      request.method === "GET"
      &&
      url.pathname === "/privacy"
    ) {

      return htmlResponse(
        "Privacy Policy",
        "TGAR Core Verification uses Roblox OAuth to identify the Roblox account you choose to authorize and to check that account's TGAR group membership and rank. The service also uses your Discord user ID to apply the appropriate TGAR Discord nickname and roles. TGAR Core does not receive or store your Roblox password. OAuth access is used only to complete the verification request. Technical logs may be retained temporarily for security, troubleshooting, and abuse prevention. By using the verification service, you authorize these checks for the purpose of verifying your TGAR membership. If you have questions about this policy, contact TGAR staff through the TGAR Discord server.",
        true,
        200,
      );
    }


    // --------------------------------------------------------
    // Terms of Service
    // --------------------------------------------------------

    if (
      request.method === "GET"
      &&
      url.pathname === "/terms"
    ) {

      return htmlResponse(
        "Terms of Service",
        "TGAR Core Verification is provided for members of the TGAR community to link a Roblox account to a Discord account for membership and rank verification. You must authorize only a Roblox account that you are permitted to use and must not misuse, interfere with, or attempt to circumvent the verification service. Verification may be refused or stopped when the Roblox account is not in TGAR or when the request is invalid or expired. TGAR members with ranks outside the configured Enlisted range may still link their account, but TGAR Core will not automatically apply an Enlisted rank or nickname during verification. The service is provided for TGAR community administration and may be changed, suspended, or discontinued when necessary. Roblox and Discord remain subject to their own terms and policies. By using TGAR Core Verification, you agree to these terms.",
        true,
        200,
      );
    }


    // --------------------------------------------------------
    // Homepage
    // --------------------------------------------------------

    return htmlResponse(
      "TGAR Core Verification",
      "TGAR Core Verification securely links a Roblox account to a Discord account for TGAR membership and rank verification. Verification must be started with /verify in the TGAR Discord server. Privacy Policy: /privacy • Terms of Service: /terms",
      true,
      200,
    );
  },
);
