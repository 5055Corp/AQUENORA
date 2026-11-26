import { MedusaService } from "@medusajs/framework/utils"
import Checkout from "./models/checkout"
import Seller from "./models/seller"
import SellerDocument from "./models/seller-document"
import StoreVisit from "./models/store-visit"
import Dispute from "./models/dispute"
import DisputeFile from "./models/dispute-file"
import ProductReport from "./models/product-report"

class SellerModuleService extends MedusaService({ Seller, Checkout, SellerDocument, StoreVisit, Dispute, DisputeFile, ProductReport }) {}

export default SellerModuleService
