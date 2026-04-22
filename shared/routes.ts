import { z } from 'zod';
import { 
  insertBusinessSchema, 
  insertEventSchema, 
  insertPostSchema, 
  insertReviewSchema,
  businesses,
  events,
  posts,
  reviews,
  type EventWithTier
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  businesses: {
    list: {
      method: 'GET' as const,
      path: '/api/businesses',
      input: z.object({
        category: z.string().optional(),
        search: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<any>()), // Returns BusinessWithRating[]
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/businesses/:id',
      responses: {
        200: z.custom<any>(), // Returns Business & { reviews: ReviewWithUser[] }
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/businesses',
      input: insertBusinessSchema,
      responses: {
        201: z.custom<typeof businesses.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
  },
  events: {
    list: {
      method: 'GET' as const,
      path: '/api/events',
      responses: {
        200: z.array(z.custom<EventWithTier>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/events',
      input: insertEventSchema,
      responses: {
        201: z.custom<typeof events.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
  },
  posts: {
    list: {
      method: 'GET' as const,
      path: '/api/posts',
      responses: {
        200: z.array(z.custom<any>()), // Returns PostWithAuthor[]
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/posts',
      input: insertPostSchema,
      responses: {
        201: z.custom<typeof posts.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    like: {
        method: 'POST' as const,
        path: '/api/posts/:id/like',
        responses: {
            200: z.object({ likes: z.number() }),
            404: errorSchemas.notFound,
            401: errorSchemas.unauthorized,
        }
    }
  },
  reviews: {
    create: {
      method: 'POST' as const,
      path: '/api/businesses/:id/reviews',
      // Optional `reviewRequestToken`: when present, the server links this
      // new review to the originating outreach row in `review_requests` so
      // the owner's funnel history shows it as "Reviewed".
      input: insertReviewSchema.extend({
        reviewRequestToken: z.string().optional(),
      }),
      responses: {
        201: z.custom<typeof reviews.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
