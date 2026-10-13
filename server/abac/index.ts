export type PolicyEffect = 'Permit' | 'Deny'
export type SupportedAction =
  | 'product.create'
  | 'product.read'
  | 'product.update'
  | 'product.archive'
  | 'inventory.adjust'
  | 'customer.read'
  | 'sale.create'
  | 'sale.read'
  | 'sale.update'
  | 'sale.void'
  | 'sale.discount'
  | 'payment.record'
  | 'report.read'
  | 'report.export'
  | 'user.update_attributes'
  | 'policy.manage'

export type ComparisonOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'contains'
  | 'exists'

export type Condition =
  | {
      field: string
      op: ComparisonOperator
      value?: unknown
    }
  | { and: Condition[] }
  | { or: Condition[] }
  | { not: Condition }

export interface PolicyTarget {
  action?: SupportedAction | string
  resourceType?: string
}

export interface PolicyDefinition {
  id: string
  name: string
  effect: PolicyEffect
  target: PolicyTarget
  condition?: Condition
  createdAt?: string
  updatedAt?: string
  createdBy?: string | null
}

export interface AbacDecision {
  effect: PolicyEffect
  reason?: string
  matchedPolicyId?: string
}

export interface DecidableContext {
  subject: Record<string, unknown>
  resource: Record<string, unknown>
  action: string
  environment: Record<string, unknown>
  policies: PolicyDefinition[]
}

const SUPPORTED_ACTIONS = new Set<SupportedAction>([
  'product.create',
  'product.read',
  'product.update',
  'product.archive',
  'inventory.adjust',
  'customer.read',
  'sale.create',
  'sale.read',
  'sale.update',
  'sale.void',
  'sale.discount',
  'payment.record',
  'report.read',
  'report.export',
  'user.update_attributes',
  'policy.manage',
])

const SUPPORTED_OPERATORS = new Set<ComparisonOperator>([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'contains',
  'exists',
])

function getFieldValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && segment in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[segment]
    }
    return undefined
  }, obj as Record<string, unknown>)
}

function compareComparableValues(left: unknown, right: unknown): number | undefined {
  if (typeof left === 'number' && typeof right === 'number') {
    if (Number.isNaN(left) || Number.isNaN(right)) return undefined
    return left < right ? -1 : left > right ? 1 : 0
  }
  if (typeof left === 'string' && typeof right === 'string') {
    return left < right ? -1 : left > right ? 1 : 0
  }
  if (typeof left === 'bigint' && typeof right === 'bigint') {
    return left < right ? -1 : left > right ? 1 : 0
  }
  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right)
  }
  return undefined
}

export function evaluateCondition(condition: Condition | undefined, context: Record<string, any>): boolean {
  if (!condition) return true

  if ('and' in condition) {
    return condition.and.every((item) => evaluateCondition(item, context))
  }

  if ('or' in condition) {
    return condition.or.some((item) => evaluateCondition(item, context))
  }

  if ('not' in condition) {
    return !evaluateCondition(condition.not, context)
  }

  if ('field' in condition) {
    const { field, op, value } = condition
    if (!SUPPORTED_OPERATORS.has(op)) {
      throw new Error(`Unsupported operator: ${op}`)
    }

    const candidate = getFieldValue(context, field)
    const isMissing = candidate === undefined || candidate === null

    if (op === 'exists') {
      return value === true ? !isMissing : isMissing
    }

    if (isMissing) {
      return false
    }

    const comparison = compareComparableValues(candidate, value)

    switch (op) {
      case 'eq':
        return candidate === value
      case 'neq':
        return candidate !== value
      case 'gt':
        return comparison !== undefined && comparison > 0
      case 'gte':
        return comparison !== undefined && comparison >= 0
      case 'lt':
        return comparison !== undefined && comparison < 0
      case 'lte':
        return comparison !== undefined && comparison <= 0
      case 'in':
        return Array.isArray(value) && value.includes(candidate as never)
      case 'contains':
        return Array.isArray(candidate) ? candidate.includes(value as never) : String(candidate).includes(String(value))
      default:
        return false
    }
  }

  return false
}

export function createPolicy(policy: PolicyDefinition): PolicyDefinition {
  if (!policy.id || !policy.name || !policy.effect || !policy.target) {
    throw new Error('Policy requires id, name, effect and target.')
  }

  if (!['Permit', 'Deny'].includes(policy.effect)) {
    throw new Error('Policy effect must be Permit or Deny.')
  }

  if (policy.target.action && !SUPPORTED_ACTIONS.has(policy.target.action as SupportedAction)) {
    throw new Error(`Unsupported action identifier: ${policy.target.action}`)
  }

  if (policy.condition) {
    validateCondition(policy.condition)
  }

  return {
    ...policy,
    createdAt: policy.createdAt ?? new Date().toISOString(),
    updatedAt: policy.updatedAt ?? new Date().toISOString(),
  }
}

function validateCondition(condition: Condition): void {
  if ('and' in condition) {
    condition.and.forEach(validateCondition)
    return
  }

  if ('or' in condition) {
    condition.or.forEach(validateCondition)
    return
  }

  if ('not' in condition) {
    validateCondition(condition.not)
    return
  }

  if ('field' in condition) {
    if (!condition.field || !SUPPORTED_OPERATORS.has(condition.op)) {
      throw new Error(`Invalid policy condition: ${JSON.stringify(condition)}`)
    }
  }
}

export class AbacPolicyEngine {
  decide(context: DecidableContext): AbacDecision {
    const relevantPolicies = context.policies.filter((policy) => {
      if (policy.target.action && policy.target.action !== context.action) {
        return false
      }
      return true
    })

    const permitPolicies = relevantPolicies.filter((policy) => policy.effect === 'Permit')
    const denyPolicies = relevantPolicies.filter((policy) => policy.effect === 'Deny')

    let matchedPermit: PolicyDefinition | undefined
    let matchedDeny: PolicyDefinition | undefined

    for (const policy of permitPolicies) {
      const ok = policy.condition ? evaluateCondition(policy.condition, {
        subject: context.subject,
        resource: context.resource,
        environment: context.environment,
      }) : true

      if (ok) {
        matchedPermit = policy
        break
      }
    }

    for (const policy of denyPolicies) {
      const ok = policy.condition ? evaluateCondition(policy.condition, {
        subject: context.subject,
        resource: context.resource,
        environment: context.environment,
      }) : true

      if (ok) {
        matchedDeny = policy
        break
      }
    }

    if (matchedDeny) {
      return {
        effect: 'Deny',
        reason: `Deny policy ${matchedDeny.id} applied.`,
        matchedPolicyId: matchedDeny.id,
      }
    }

    if (matchedPermit) {
      return {
        effect: 'Permit',
        reason: `Permit policy ${matchedPermit.id} applied.`,
        matchedPolicyId: matchedPermit.id,
      }
    }

    return {
      effect: 'Deny',
      reason: 'No applicable policy permits this action.',
    }
  }
}

export const abacPolicyEngine = new AbacPolicyEngine()
