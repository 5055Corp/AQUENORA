import { MedusaService } from "@medusajs/framework/utils"
import Checkout from "./models/checkout"
import Seller from "./models/seller"
import SellerDocument from "./models/seller-document"

class SellerModuleService extends MedusaService({ Seller, Checkout, SellerDocument }) {}

export default SellerModuleService
