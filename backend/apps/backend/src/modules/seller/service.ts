import { MedusaService } from "@medusajs/framework/utils"
import Checkout from "./models/checkout"
import Seller from "./models/seller"

class SellerModuleService extends MedusaService({ Seller, Checkout }) {}

export default SellerModuleService
