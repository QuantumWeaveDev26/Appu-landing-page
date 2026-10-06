import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { TransactionalQueryable } from '../db/types.js';
import type { AuthVerifier, AuthenticatedPrincipal } from '../domain/auth/types.js';
import { UnauthorizedError, ForbiddenError } from '../errors/index.js';

export interface AdminRouteOptions {
  db: TransactionalQueryable;
  authVerifier: AuthVerifier;
  /** Comma-separated allowlist of admin emails (APPU_ADMIN_EMAILS). */
  adminEmails?: string;
}

function parseAdminEmails(raw?: string): Set<string> {
  const set = new Set<string>();
  if (!raw) return set;
  for (const part of raw.split(',')) {
    const e = part.trim().toLowerCase();
    if (e) set.add(e);
  }
  return set;
}

/**
 * Resolves the caller's identity from the Bearer token and asserts it is an admin.
 * Admin authority comes ONLY from the server-side APPU_ADMIN_EMAILS allowlist --
 * never from anything in the request body or a client-supplied flag.
 */
async function requireAdmin(
  request: FastifyRequest,
  authVerifier: AuthVerifier,
  admins: Set<string>
): Promise<AuthenticatedPrincipal> {
  const authHeader = request.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    throw new UnauthorizedError('Authentication required');
  }
  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    throw new UnauthorizedError('Malformed Authorization header. Expected "Bearer <token>"');
  }
  const principal = await authVerifier.verifyAccessToken(parts[1]);
  const email = (principal.email || '').toLowerCase();
  if (!email || !admins.has(email)) {
    throw new ForbiddenError('Admin access required');
  }
  return principal;
}

export const adminRoutes: FastifyPluginAsync<AdminRouteOptions> = async (fastify, opts) => {
  const admins = parseAdminEmails(opts.adminEmails);

  /**
   * GET /api/admin/overview
   * High-level, read-only metrics for the admin dashboard: account totals &
   * sign-ups, activity, free-trial usage, subscription breakdown, and MRR.
   */
  fastify.get('/api/admin/overview', async (request, reply) => {
    await requireAdmin(request, opts.authVerifier, admins);

    const [accounts, children, chats, guests, subs, revenue, signupSeries] = await Promise.all([
      opts.db.query<any>(`
        SELECT
          (SELECT count(*) FROM auth.users) AS total,
          (SELECT count(*) FROM auth.users WHERE created_at >= now() - interval '1 day')  AS new_1d,
          (SELECT count(*) FROM auth.users WHERE created_at >= now() - interval '7 days')  AS new_7d,
          (SELECT count(*) FROM auth.users WHERE created_at >= now() - interval '30 days') AS new_30d,
          (SELECT count(*) FROM auth.users WHERE last_sign_in_at >= now() - interval '7 days') AS active_7d
      `),
      opts.db.query<any>(`SELECT count(*) AS total FROM child_profiles`),
      opts.db.query<any>(`
        SELECT
          count(*)                                           AS total,
          count(*) FILTER (WHERE status = 'SUCCEEDED')       AS succeeded,
          count(*) FILTER (WHERE actor_type = 'guest')       AS guest,
          count(*) FILTER (WHERE actor_type = 'authenticated') AS authenticated,
          count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS last_7d
        FROM appu_requests
      `),
      opts.db.query<any>(`SELECT count(*) AS total FROM guest_sessions`),
      opts.db.query<any>(`SELECT status, count(*) AS n FROM subscriptions GROUP BY status`),
      opts.db.query<any>(`
        SELECT COALESCE(SUM(p.amount_paise), 0) AS mrr_paise
        FROM subscriptions s JOIN plans p ON p.id = s.plan_id
        WHERE s.status = 'ACTIVE'
      `),
      opts.db.query<any>(`
        SELECT to_char(d::date, 'YYYY-MM-DD') AS day, count(u.id) AS n
        FROM generate_series(now()::date - interval '13 days', now()::date, interval '1 day') d
        LEFT JOIN auth.users u ON u.created_at::date = d::date
        GROUP BY d ORDER BY d
      `)
    ]);

    const a = accounts.rows[0] || {};
    const c = chats.rows[0] || {};
    const subscriptionsByStatus: Record<string, number> = {};
    for (const row of subs.rows) subscriptionsByStatus[row.status] = Number(row.n);

    return reply.status(200).send({
      accounts: {
        total: Number(a.total || 0),
        newToday: Number(a.new_1d || 0),
        new7d: Number(a.new_7d || 0),
        new30d: Number(a.new_30d || 0),
        active7d: Number(a.active_7d || 0)
      },
      children: Number((children.rows[0] || {}).total || 0),
      chats: {
        total: Number(c.total || 0),
        succeeded: Number(c.succeeded || 0),
        guest: Number(c.guest || 0),
        authenticated: Number(c.authenticated || 0),
        last7d: Number(c.last_7d || 0)
      },
      guestSessions: Number((guests.rows[0] || {}).total || 0),
      subscriptions: subscriptionsByStatus,
      revenue: {
        activeMrrPaise: Number((revenue.rows[0] || {}).mrr_paise || 0),
        currency: 'INR'
      },
      signupsLast14Days: signupSeries.rows.map((r: any) => ({ day: r.day, count: Number(r.n) }))
    });
  });

  /**
   * GET /api/admin/users?limit&offset&search
   * Read-only, paginated list of registered accounts with per-account rollups.
   */
  fastify.get('/api/admin/users', async (request, reply) => {
    await requireAdmin(request, opts.authVerifier, admins);

    const q = request.query as Record<string, string>;
    const limit = Math.min(Math.max(parseInt(q.limit || '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(q.offset || '0', 10) || 0, 0);
    const search = (q.search || '').trim() || null;

    const [list, count] = await Promise.all([
      opts.db.query<any>(`
        SELECT
          u.id,
          u.email,
          u.created_at       AS signup_at,
          u.last_sign_in_at,
          hm.household_id,
          COALESCE(ch.n, 0)  AS children,
          COALESCE(rq.n, 0)  AS chats,
          rq.last_activity,
          sub.status         AS subscription_status
        FROM auth.users u
        LEFT JOIN LATERAL (
          SELECT household_id FROM household_members m
          WHERE m.user_id = u.id ORDER BY m.created_at ASC LIMIT 1
        ) hm ON true
        LEFT JOIN LATERAL (
          SELECT count(*) AS n FROM child_profiles c WHERE c.household_id = hm.household_id
        ) ch ON true
        LEFT JOIN LATERAL (
          SELECT count(*) AS n, max(created_at) AS last_activity
          FROM appu_requests r WHERE r.household_id = hm.household_id
        ) rq ON true
        LEFT JOIN LATERAL (
          SELECT status FROM subscriptions s
          WHERE s.household_id = hm.household_id ORDER BY s.created_at DESC LIMIT 1
        ) sub ON true
        WHERE ($1::text IS NULL OR u.email ILIKE '%' || $1 || '%')
        ORDER BY u.created_at DESC
        LIMIT $2 OFFSET $3
      `, [search, limit, offset]),
      opts.db.query<any>(
        `SELECT count(*) AS total FROM auth.users u WHERE ($1::text IS NULL OR u.email ILIKE '%' || $1 || '%')`,
        [search]
      )
    ]);

    return reply.status(200).send({
      total: Number((count.rows[0] || {}).total || 0),
      limit,
      offset,
      users: list.rows.map((r: any) => ({
        id: r.id,
        email: r.email,
        signupAt: r.signup_at,
        lastSignInAt: r.last_sign_in_at,
        householdId: r.household_id,
        children: Number(r.children || 0),
        chats: Number(r.chats || 0),
        lastActivity: r.last_activity,
        subscriptionStatus: r.subscription_status || null
      }))
    });
  });
};
