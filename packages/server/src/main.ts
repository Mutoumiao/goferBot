import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from './app.module.js'
import { bootstrap } from './bootstrap.js'

async function main() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  )

  await bootstrap(app)

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000
  await app.listen(port, '0.0.0.0')

  console.log(`Server running on http://localhost:${port}`)
}

main()
