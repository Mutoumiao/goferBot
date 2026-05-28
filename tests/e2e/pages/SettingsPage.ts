import type { Page, Locator } from '@playwright/test'

export class SettingsPage {
  readonly page: Page
  readonly navTabs: Locator
  readonly saveBtn: Locator
  readonly errorMessage: Locator
  readonly successMessage: Locator
  readonly temperatureValue: Locator
  readonly temperatureSlider: Locator
  readonly embeddingCard: Locator
  readonly embeddingProviderSelect: Locator
  readonly embeddingApiKeyInput: Locator
  readonly embeddingModelInput: Locator
  readonly embeddingBaseUrlInput: Locator

  constructor(page: Page) {
    this.page = page
    this.navTabs = page.locator('[data-testid="settings-nav-tabs"]')
    this.saveBtn = page.locator('[data-testid="settings-save-btn"]').first()
    this.errorMessage = page.locator('[data-testid="settings-error"]')
    this.successMessage = page.locator('[data-testid="settings-success"]')
    this.temperatureValue = page.locator('[data-testid="temperature-value"]')
    this.temperatureSlider = page.locator('[data-testid="temperature-slider"]')
    this.embeddingCard = page.locator('[data-testid="embedding-card"]')
    this.embeddingProviderSelect = page.locator('[data-testid="embedding-provider-select"]')
    this.embeddingApiKeyInput = page.locator('[data-testid="embedding-api-key-input"]')
    this.embeddingModelInput = page.locator('[data-testid="embedding-model-input"]')
    this.embeddingBaseUrlInput = page.locator('[data-testid="embedding-baseurl-input"]')
  }

  async goto() {
    await this.page.goto('/app/settings')
  }

  async clickTab(name: string) {
    await this.navTabs.locator(`text=${name}`).first().click()
  }

  async fillInput(name: string, value: string) {
    await this.page.locator(`[name="${name}"]`).first().fill(value)
  }

  async save() {
    await this.saveBtn.click()
  }

  async getErrorMessages(): Promise<string[]> {
    return this.errorMessage.allTextContents()
  }

  async selectEmbeddingProvider(providerLabel: string) {
    await this.embeddingProviderSelect.click()
    await this.page.locator(`[role="option"]:has-text("${providerLabel}")`).click()
  }

  async fillEmbeddingApiKey(value: string) {
    await this.embeddingApiKeyInput.fill(value)
  }

  async fillEmbeddingModel(value: string) {
    await this.embeddingModelInput.fill(value)
  }

  async setTemperature(value: number) {
    await this.temperatureSlider.evaluate((el: HTMLInputElement, v: number) => {
      el.value = String(v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }, value)
  }

  async getTemperatureValue(): Promise<string> {
    return (await this.temperatureValue.textContent()) ?? ''
  }

  async isSaveButtonEnabled(): Promise<boolean> {
    return await this.saveBtn.isEnabled()
  }
}
