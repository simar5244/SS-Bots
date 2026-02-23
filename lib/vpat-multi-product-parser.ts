import { OpenAI } from 'openai'
import { WCAGCriterion, PlatformVersion } from './vpat-parser'
import { vpatNegligibleImpactHandler } from './vpat-negligible-impact-handler'
import { vpatPlatformParser } from './vpat-platform-parser'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface ProductVariant {
  productName: string
  productType: string
  criteria: WCAGCriterion[]
  platformVariations?: {
    hasPlatformVariations: boolean
    platforms: string[]
  }
}

export interface MultiProductAnalysis {
  hasMultipleProducts: boolean
  products: ProductVariant[]
  commonCriteria: WCAGCriterion[]
  divergentCriteria: Array<{
    criterionId: string
    criterionName: string
    variants: Array<{
      productType: string
      conformanceLevel: string
      remarks?: string
    }>
  }>
}

export class VPATMultiProductParser {
  
  async detectAndSeparateProducts(
    documentText: string,
    extractedCriteria: WCAGCriterion[]
  ): Promise<MultiProductAnalysis> {
    
    console.log('🔍 [MULTI-PRODUCT] Starting detection...')
    
    const platformAnalysis = await vpatPlatformParser.detectPlatformVariations(documentText, extractedCriteria)
    
    if (platformAnalysis.hasPlatformVariations) {
      console.log('✅ [MULTI-PRODUCT] Platform variations detected, using platform-aware processing')
      return this.handlePlatformVariations(platformAnalysis, extractedCriteria)
    }
    
    const detectionPrompt = `Analyze this VPAT document to determine if it covers multiple product variants or platforms:

${documentText.substring(0, 20000)}

Look for indicators such as:
- Multiple product names or versions (e.g., "Web Version", "Mobile App", "Desktop Application")
- Platform-specific sections (e.g., "iOS", "Android", "Web")
- Separate conformance tables for different products
- Criteria with different conformance levels for different platforms

Return JSON:
{
  "hasMultipleProducts": boolean,
  "productTypes": ["Web", "Mobile", "Desktop"] or [],
  "separationStrategy": "Description of how products are separated in the document"
}`

    try {
      const detectionResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert at analyzing VPAT documents and identifying multi-product or multi-platform accessibility reports. Return only valid JSON.' 
          },
          { role: 'user', content: detectionPrompt }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })

      const detection = JSON.parse(detectionResponse.choices[0].message.content || '{}')

      if (!detection.hasMultipleProducts || !detection.productTypes || detection.productTypes.length === 0) {
        return {
          hasMultipleProducts: false,
          products: [],
          commonCriteria: extractedCriteria,
          divergentCriteria: []
        }
      }

      const separationPrompt = `This VPAT document covers multiple products/platforms: ${detection.productTypes.join(', ')}.

Document text:
${documentText.substring(0, 30000)}

For EACH criterion in the list below, determine its conformance level for EACH product type.

Criteria to analyze:
${extractedCriteria.map(c => `${c.criterionId}: ${c.criterionName}`).join('\n')}

Return JSON with this structure:
{
  "products": [
    {
      "productName": "Product Name",
      "productType": "Web|Mobile|Desktop",
      "criteria": [
        {
          "criterionId": "1.1.1",
          "criterionName": "Non-text Content",
          "level": "A",
          "conformanceLevel": "Supports|Partially Supports|Does Not Support|Not Applicable|Not Evaluated",
          "remarks": "Platform-specific notes",
          "pageNumber": 5,
          "excerpt": "Relevant text from document",
          "confidence": 85
        }
      ]
    }
  ]
}

IMPORTANT: Return data for ALL ${extractedCriteria.length} criteria for EACH product type.`

      const separationResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: `You are separating multi-product VPAT data. You MUST return ${extractedCriteria.length} criteria for EACH of the ${detection.productTypes.length} product types. Return only valid JSON.` 
          },
          { role: 'user', content: separationPrompt }
        ],
        temperature: 0,
        response_format: { type: 'json_object' }
      })

      const separation = JSON.parse(separationResponse.choices[0].message.content || '{}')

      const products: ProductVariant[] = (separation.products || []).map((p: any) => ({
        productName: p.productName,
        productType: p.productType,
        criteria: (p.criteria || []).map((c: any) => ({
          criterionId: c.criterionId,
          criterionName: c.criterionName,
          level: c.level,
          conformanceLevel: c.conformanceLevel,
          scorecardEquivalent: this.mapToScorecardEquivalent(c.conformanceLevel),
          remarks: c.remarks,
          pageNumber: c.pageNumber,
          excerpt: c.excerpt,
          confidence: c.confidence
        }))
      }))

      const { commonCriteria, divergentCriteria } = this.analyzeProductDifferences(products)

      console.log('✅ [MULTI-PRODUCT] Multi-product analysis complete:', {
        products: products.length,
        commonCriteria: commonCriteria.length,
        divergentCriteria: divergentCriteria.length
      })

      return {
        hasMultipleProducts: true,
        products,
        commonCriteria,
        divergentCriteria
      }

    } catch (error) {
      console.error('Multi-product detection error:', error)
      console.log('ℹ️ [MULTI-PRODUCT] No multiple products detected')
      return {
        hasMultipleProducts: false,
        products: [],
        commonCriteria: extractedCriteria,
        divergentCriteria: []
      }
    }
  }

  private async handlePlatformVariations(
    platformAnalysis: any,
    extractedCriteria: WCAGCriterion[]
  ): Promise<MultiProductAnalysis> {
    console.log('🔄 [MULTI-PRODUCT] Handling platform variations as product variants')
    
    const mergedCriteria = vpatPlatformParser.mergePlatformVariationsIntoCriteria(platformAnalysis)
    
    const products: ProductVariant[] = platformAnalysis.detectedPlatforms.map((platform: string) => {
      const platformCriteria = mergedCriteria.map(criterion => {
        if (criterion.hasPlatformVariations && criterion.platformVersions) {
          const platformVersion = criterion.platformVersions.find(pv => pv.platform === platform)
          if (platformVersion) {
            return {
              ...criterion,
              conformanceLevel: platformVersion.conformanceLevel,
              scorecardEquivalent: platformVersion.scorecardEquivalent,
              remarks: platformVersion.remarks || criterion.remarks,
              pageNumber: platformVersion.pageNumber || criterion.pageNumber,
              excerpt: platformVersion.excerpt || criterion.excerpt,
              confidence: platformVersion.confidence || criterion.confidence
            }
          }
        }
        return criterion
      })

      return {
        productName: platform,
        productType: platform,
        criteria: platformCriteria,
        platformVariations: {
          hasPlatformVariations: true,
          platforms: platformAnalysis.detectedPlatforms
        }
      }
    })

    const { commonCriteria, divergentCriteria } = this.analyzeProductDifferences(products)

    console.log('✅ [MULTI-PRODUCT] Platform-based product separation complete:', {
      platforms: products.length,
      criteriaWithVariations: platformAnalysis.criteriaWithVariations.length
    })

    return {
      hasMultipleProducts: true,
      products,
      commonCriteria,
      divergentCriteria
    }
  }

  private analyzeProductDifferences(products: ProductVariant[]): {
    commonCriteria: WCAGCriterion[]
    divergentCriteria: Array<{
      criterionId: string
      criterionName: string
      variants: Array<{
        productType: string
        conformanceLevel: string
        remarks?: string
      }>
    }>
  } {
    if (products.length === 0) {
      return { commonCriteria: [], divergentCriteria: [] }
    }

    const criteriaMap = new Map<string, WCAGCriterion[]>()

    products.forEach(product => {
      product.criteria.forEach(criterion => {
        if (!criteriaMap.has(criterion.criterionId)) {
          criteriaMap.set(criterion.criterionId, [])
        }
        criteriaMap.get(criterion.criterionId)!.push({
          ...criterion,
          productType: product.productType
        } as any)
      })
    })

    const commonCriteria: WCAGCriterion[] = []
    const divergentCriteria: Array<{
      criterionId: string
      criterionName: string
      variants: Array<{
        productType: string
        conformanceLevel: string
        remarks?: string
      }>
    }> = []

    criteriaMap.forEach((variants, criterionId) => {
      const conformanceLevels = new Set(variants.map(v => v.conformanceLevel))
      
      if (conformanceLevels.size === 1) {
        commonCriteria.push(variants[0])
      } else {
        divergentCriteria.push({
          criterionId,
          criterionName: variants[0].criterionName,
          variants: variants.map(v => ({
            productType: (v as any).productType,
            conformanceLevel: v.conformanceLevel,
            remarks: v.remarks
          }))
        })
      }
    })

    return { commonCriteria, divergentCriteria }
  }

  private mapToScorecardEquivalent(conformanceLevel: string): 'Supports' | 'Partially Supports' | 'Does Not Support' | 'Not Applicable' {
    if (conformanceLevel === 'Not Applicable') return 'Not Applicable'
    if (conformanceLevel === 'Not Evaluated') return 'Does Not Support'
    if (conformanceLevel === 'Supports') return 'Supports'
    if (conformanceLevel === 'Partially Supports') return 'Partially Supports'
    return 'Does Not Support'
  }
}

export const vpatMultiProductParser = new VPATMultiProductParser()
