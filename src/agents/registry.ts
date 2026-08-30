import { AgentDefinition } from './types';
import { leadGenMapsAgent } from './lead-gen-maps';
import { coldOutreachAgent } from './cold-outreach';
import { customerSupportWhatsappAgent } from './customer-support-whatsapp';
import { orderHandlerAgent } from './order-handler';
import { invoiceGeneratorAgent } from './invoice-generator';
import { appointmentBookerAgent } from './appointment-booker';
import { socialMediaManagerAgent } from './social-media-manager';
import { linkedinOutreachAgent } from './linkedin-outreach';
import { emailNurturerAgent } from './email-nurturer';
import { dealCloserAgent } from './deal-closer';
import { salesAnalystAgent } from './sales-analyst';
import { competitorTrackerAgent } from './competitor-tracker';
import { pricingOptimizerAgent } from './pricing-optimizer';
import { referralManagerAgent } from './referral-manager';
import { leadQualifierAgent } from './lead-qualifier';
import { helpdeskTicketerAgent } from './helpdesk-ticketer';
import { refundProcessorAgent } from './refund-processor';
import { loyaltyManagerAgent } from './loyalty-manager';
import { feedbackAnalyzerAgent } from './feedback-analyzer';
import { faqGeneratorAgent } from './faq-generator';
import { sentimentMonitorAgent } from './sentiment-monitor';
import { disputeResolverAgent } from './dispute-resolver';
import { onboardingSpecialistAgent } from './onboarding-specialist';
import { churnPredictorAgent } from './churn-predictor';
import { inventoryCheckerAgent } from './inventory-checker';
import { shippingTrackerAgent } from './shipping-tracker';
import { vendorManagerAgent } from './vendor-manager';
import { fleetCoordinatorAgent } from './fleet-coordinator';
import { warehouseManagerAgent } from './warehouse-manager';
import { supplyChainOptimizerAgent } from './supply-chain-optimizer';
import { procurementAgent } from './procurement-agent';
import { contentCalendarPlannerAgent } from './content-calendar-planner';
import { adCampaignManagerAgent } from './ad-campaign-manager';
import { seoOptimizerAgent } from './seo-optimizer';
import { brandMonitorAgent } from './brand-monitor';
import { influencerOutreachAgent } from './influencer-outreach';
import { newsletterWriterAgent } from './newsletter-writer';
import { videoScriptGeneratorAgent } from './video-script-generator';
import { graphicDesignBriefWriterAgent } from './graphic-design-brief-writer';
import { communityModeratorAgent } from './community-moderator';
import { expenseTrackerAgent } from './expense-tracker';
import { payrollAssistantAgent } from './payroll-assistant';
import { taxComplianceCheckerAgent } from './tax-compliance-checker';
import { travelPlannerAgent } from './travel-planner';
import { documentSummarizerAgent } from './document-summarizer';
import { meetingSchedulerAgent } from './meeting-scheduler';
import { legalContractReviewerAgent } from './legal-contract-reviewer';
import { projectManagerAiAgent } from './project-manager-ai';
import { virtualReceptionistAgent } from './virtual-receptionist';
import { marketResearchAnalystAgent } from './market-research-analyst';
import { itSupportBotAgent } from './it-support-bot';
import { assistantAgent } from './assistant';
import { coderAgent } from './coder';
import { researcherAgent } from './researcher';
import { getAgentSetup } from './setup-metadata';

export const AGENT_REGISTRY: Record<string, AgentDefinition> = {
  'lead-gen-maps': leadGenMapsAgent,
  'cold-outreach': coldOutreachAgent,
  'customer-support-whatsapp': customerSupportWhatsappAgent,
  'order-handler': orderHandlerAgent,
  'invoice-generator': invoiceGeneratorAgent,
  'appointment-booker': appointmentBookerAgent,
  'social-media-manager': socialMediaManagerAgent,
  'linkedin-outreach': linkedinOutreachAgent,
  'email-nurturer': emailNurturerAgent,
  'deal-closer': dealCloserAgent,
  'sales-analyst': salesAnalystAgent,
  'competitor-tracker': competitorTrackerAgent,
  'pricing-optimizer': pricingOptimizerAgent,
  'referral-manager': referralManagerAgent,
  'lead-qualifier': leadQualifierAgent,
  'helpdesk-ticketer': helpdeskTicketerAgent,
  'refund-processor': refundProcessorAgent,
  'loyalty-manager': loyaltyManagerAgent,
  'feedback-analyzer': feedbackAnalyzerAgent,
  'faq-generator': faqGeneratorAgent,
  'sentiment-monitor': sentimentMonitorAgent,
  'dispute-resolver': disputeResolverAgent,
  'onboarding-specialist': onboardingSpecialistAgent,
  'churn-predictor': churnPredictorAgent,
  'inventory-checker': inventoryCheckerAgent,
  'shipping-tracker': shippingTrackerAgent,
  'vendor-manager': vendorManagerAgent,
  'fleet-coordinator': fleetCoordinatorAgent,
  'warehouse-manager': warehouseManagerAgent,
  'supply-chain-optimizer': supplyChainOptimizerAgent,
  'procurement-agent': procurementAgent,
  'content-calendar-planner': contentCalendarPlannerAgent,
  'ad-campaign-manager': adCampaignManagerAgent,
  'seo-optimizer': seoOptimizerAgent,
  'brand-monitor': brandMonitorAgent,
  'influencer-outreach': influencerOutreachAgent,
  'newsletter-writer': newsletterWriterAgent,
  'video-script-generator': videoScriptGeneratorAgent,
  'graphic-design-brief-writer': graphicDesignBriefWriterAgent,
  'community-moderator': communityModeratorAgent,
  'expense-tracker': expenseTrackerAgent,
  'payroll-assistant': payrollAssistantAgent,
  'tax-compliance-checker': taxComplianceCheckerAgent,
  'travel-planner': travelPlannerAgent,
  'document-summarizer': documentSummarizerAgent,
  'meeting-scheduler': meetingSchedulerAgent,
  'legal-contract-reviewer': legalContractReviewerAgent,
  'project-manager-ai': projectManagerAiAgent,
  'virtual-receptionist': virtualReceptionistAgent,
  'market-research-analyst': marketResearchAnalystAgent,
  'it-support-bot': itSupportBotAgent,
  'assistant': assistantAgent,
  'coder': coderAgent,
  'researcher': researcherAgent,
};

export const getAgentById = (id: string): AgentDefinition | undefined => {
  const agent = AGENT_REGISTRY[id];
  return agent ? { ...agent, ...getAgentSetup(agent) } : undefined;
};

export const getAllAgents = (): AgentDefinition[] => {
  return Object.values(AGENT_REGISTRY).map((agent) => ({ ...agent, ...getAgentSetup(agent) }));
};

export const getAgentsByCategory = (category: string): AgentDefinition[] => {
  return getAllAgents().filter(agent => agent.category === category);
};

export const getAgentCategories = (): string[] => {
  const categories = new Set(getAllAgents().map(agent => agent.category));
  return Array.from(categories);
};

