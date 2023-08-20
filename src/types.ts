export type PrometheusPostBody = {
  query: string
  start: string
  end: string
  step: string
}

export type PrometheusPostResponse = {
  status: string
  data: {
    resultType: string
    result: {
      metric: Record<string, string | undefined> // added undefined to delete properties quicker
      values: [number, string][]
    }[]
  }
}
