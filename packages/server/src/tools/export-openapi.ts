import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { cleanupOpenApiDoc } from 'nestjs-zod'
import { AppModule } from '../app.module.js'

async function exportOpenApi() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter())

  const config = new DocumentBuilder()
    .setTitle('GoferBot API')
    .setDescription('GoferBot 云端 AI Workspace API 文档')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build()

  const document = SwaggerModule.createDocument(app, config)
  const cleanedDocument = cleanupOpenApiDoc(document)

  const outputPath = resolve(process.cwd(), 'openapi.json')
  writeFileSync(outputPath, JSON.stringify(cleanedDocument, null, 2))

  console.log(`OpenAPI spec exported to ${outputPath}`)
  await app.close()
}

exportOpenApi().catch((err) => {
  console.error(err)
  process.exit(1)
})
