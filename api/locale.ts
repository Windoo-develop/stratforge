export const config = {
  runtime: 'edge',
}

const RUSSIAN_REGION_COUNTRIES = new Set(['RU', 'KZ', 'BY', 'UA'])

export default function handler(request: Request) {
  const country = request.headers.get('x-vercel-ip-country')?.toUpperCase() ?? null
  const locale = country && RUSSIAN_REGION_COUNTRIES.has(country) ? 'ru' : 'en'

  return new Response(
    JSON.stringify({
      locale,
      country,
    }),
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=0, s-maxage=300',
        vary: 'x-vercel-ip-country',
      },
    },
  )
}
