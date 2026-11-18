import { MedusaService } from "@medusajs/framework/utils"
import Checkout from "./models/checkout"
import Seller from "./models/seller"
import SellerDocument from "./models/seller-document"
import StoreVisit from "./models/store-visit"

class SellerModuleService extends MedusaService({ Seller, Checkout, SellerDocument, StoreVisit }) {}

export default SellerModuleService
