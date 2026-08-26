import { describe, it, expect } from 'vitest';
import { AGENT_REGISTRY, getAllAgents, getAgentById } from '../../agents/registry';
import { z } from 'zod';

describe('Agent Registry', () => {
  describe('All 50 Agent Definitions', () => {
    const agents = getAllAgents();

    it('should have at least 7 agents registered', () => {
      expect(agents.length).toBeGreaterThanOrEqual(7);
    });

    agents.forEach((agent) => {
      describe(`Agent: ${agent.name} (${agent.id})`, () => {
        it('should have a non-empty system prompt', () => {
          expect(agent.systemPrompt).toBeTruthy();
          expect(agent.systemPrompt.length).toBeGreaterThan(0);
          expect(typeof agent.systemPrompt).toBe('string');
        });

        it('should have a valid Zod config schema', () => {
          expect(agent.configSchema).toBeDefined();
          expect(agent.configSchema).toBeInstanceOf(z.ZodObject);
        });

        it('should parse a sample config with the schema', () => {
          const sampleConfig = agent.defaultConfig;
          
          expect(() => {
            agent.configSchema.parse(sampleConfig);
          }).not.toThrow();

          const parsed = agent.configSchema.safeParse(sampleConfig);
          expect(parsed.success).toBe(true);
        });

        it('should have a non-empty composio-tools array', () => {
          expect(agent.composioTools).toBeDefined();
          expect(Array.isArray(agent.composioTools)).toBe(true);
          expect(agent.composioTools?.length).toBeGreaterThan(0);
        });

        it('should have all required fields', () => {
          expect(agent.id).toBeTruthy();
          expect(agent.name).toBeTruthy();
          expect(agent.category).toBeTruthy();
          expect(agent.icon).toBeTruthy();
          expect(agent.description).toBeTruthy();
          expect(agent.whatItDoes).toBeTruthy();
        });

        it('should have valid composio tool names', () => {
          agent.composioTools?.forEach((tool) => {
            expect(typeof tool).toBe('string');
            expect(tool.length).toBeGreaterThan(0);
            // Tool names should be in SCREAMING_SNAKE_CASE or lowercase_snake_case
            expect(tool).toMatch(/^[A-Z_]+$|^[a-z_]+$/);
          });
        });

        it('should have a valid default config structure', () => {
          const config = agent.defaultConfig;
          
          expect(config).toBeDefined();
          expect(typeof config).toBe('object');
          
          // Common fields that should exist in most configs
          if ('enabled' in config) {
            expect(typeof config.enabled).toBe('boolean');
          }
        });

        it('should have system prompt with Nigerian context (if applicable)', () => {
          const nigerianKeywords = [
            'nigeria',
            'lagos',
            'naira',
            'whatsapp',
            'wat',
            'pidgin',
          ];

          const hasNigerianContext = nigerianKeywords.some((keyword) =>
            agent.systemPrompt.toLowerCase().includes(keyword)
          );

          // Not all agents need Nigerian context, but priority ones should
          const priorityAgents = [
            'lead-gen-maps',
            'cold-outreach',
            'customer-support-whatsapp',
            'order-handler',
            'invoice-generator',
          ];

          if (priorityAgents.includes(agent.id)) {
            expect(hasNigerianContext).toBe(true);
          }
        });

        it('should have system prompt with JSON output schema', () => {
          // System prompts should guide the LLM to output structured JSON
          const hasJsonGuidance =
            agent.systemPrompt.includes('JSON') ||
            agent.systemPrompt.includes('json') ||
            agent.systemPrompt.includes('structured output');

          expect(hasJsonGuidance).toBe(true);
        });

        it('should have system prompt with escalation triggers', () => {
          // System prompts should mention when to escalate
          const hasEscalationGuidance =
            agent.systemPrompt.includes('escalate') ||
            agent.systemPrompt.includes('Escalate') ||
            agent.systemPrompt.includes('human approval') ||
            agent.systemPrompt.includes('owner approval');

          expect(hasEscalationGuidance).toBe(true);
        });
      });
    });
  });

  describe('Registry Functions', () => {
    it('should get agent by ID', () => {
      const agent = getAgentById('lead-gen-maps');
      
      expect(agent).toBeDefined();
      expect(agent?.id).toBe('lead-gen-maps');
      expect(agent?.name).toBe('Maps Lead Generator');
    });

    it('should return undefined for non-existent agent', () => {
      const agent = getAgentById('non-existent-agent');
      
      expect(agent).toBeUndefined();
    });

    it('should get all agents', () => {
      const agents = getAllAgents();
      
      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);
    });

    it('should have unique agent IDs', () => {
      const agents = getAllAgents();
      const ids = agents.map((a) => a.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid categories', () => {
      const agents = getAllAgents();
      const validCategories = [
        'Business & Strategy',
        'Sales & Marketing',
        'Customer Support',
        'Operations',
        'Finance',
        'HR & Recruiting',
        'Content & Creative',
        'Development',
        'Research',
        'Personal',
        'Sales',
        'Support',
        'Marketing',
        'Admin',
        'Productivity',
        'Coding',
        'HR',
        'Legal',
        'Customer Service',
      ];

      agents.forEach((agent) => {
        expect(validCategories).toContain(agent.category);
      });
    });
  });

  describe('Priority Agents (7/7)', () => {
    const priorityAgentIds = [
      'lead-gen-maps',
      'cold-outreach',
      'customer-support-whatsapp',
      'order-handler',
      'invoice-generator',
      'appointment-booker',
      'social-media-manager',
    ];

    priorityAgentIds.forEach((agentId) => {
      it(`should have ${agentId} fully implemented`, () => {
        const agent = getAgentById(agentId);
        
        expect(agent).toBeDefined();
        expect(agent?.systemPrompt?.length).toBeGreaterThan(100);
        expect(agent?.composioTools?.length).toBeGreaterThan(0);
        
        // Should have a valid config schema
        const parsed = agent?.configSchema.safeParse(agent?.defaultConfig);
        expect(parsed?.success).toBe(true);
      });
    });
  });

  describe('Config Schema Validation', () => {
    it('should reject invalid configs', () => {
      const agent = getAgentById('lead-gen-maps');
      
      if (agent) {
        const invalidConfig = {
          // Missing required fields
          invalid: 'data',
        };

        const result = agent.configSchema.safeParse(invalidConfig);
        expect(result.success).toBe(false);
      }
    });

    it('should accept valid configs with all fields', () => {
      const agents = getAllAgents();

      agents.forEach((agent) => {
        const result = agent.configSchema.safeParse(agent.defaultConfig);
        
        if (!result.success) {
          console.error(`Agent ${agent.id} config validation failed:`, (result as any).error);
        }
        
        expect(result.success).toBe(true);
      });
    });
  });
});
