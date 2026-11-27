import { MedusaService } from "@medusajs/framework/utils"
import MarketingCampaign from "./models/campaign"
import MarketingContact from "./models/contact"
import MarketingSchedule from "./models/schedule"

class MarketingModuleService extends MedusaService({ MarketingContact, MarketingCampaign, MarketingSchedule }) {}

export default MarketingModuleService
