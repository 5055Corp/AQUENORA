import { MedusaService } from "@medusajs/framework/utils"
import MarketingCampaign from "./models/campaign"
import MarketingContact from "./models/contact"

class MarketingModuleService extends MedusaService({ MarketingContact, MarketingCampaign }) {}

export default MarketingModuleService
