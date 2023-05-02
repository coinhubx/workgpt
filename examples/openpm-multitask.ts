import { Calculator } from '../src/apis/calculator'
import { FactApi } from '../src/apis/fact'
import { OpenpmApi } from '../src/apis/openpm'
import { OpenApiAgent } from '../src/chat-agents/openapi'
import { WorkGptRunner } from '../src/runners/workgpt'

async function main() {
  const agent = new OpenApiAgent({
    verbose: true,
    temperature: 0.1,
    model: 'gpt-4',
  })

  const apis = await Promise.all([
    OpenpmApi.fromPackageId('serpapi-search', {
      authKey: process.env.SERPAPI_API_KEY!,
    }),
    new Calculator(),
    new FactApi(),
  ])

  const runner = new WorkGptRunner({
    agent,
    apis,
    onResult: (result) => {
      console.log('Result', result)
    },
  })

  await runner.runWithDirective(
    'What is the the five day forecast for San Francisco?'
  )
}

main()
