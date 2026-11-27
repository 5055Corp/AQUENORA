import { MedusaService } from "@medusajs/framework/utils"
import Checkout from "./models/checkout"
import Seller from "./models/seller"
import SellerDocument from "./models/seller-document"
import StoreVisit from "./models/store-visit"
import Dispute from "./models/dispute"
import DisputeFile from "./models/dispute-file"
import ProductReport from "./models/product-report"
import StockAlert from "./models/stock-alert"
import BookingService from "./models/booking-service"
import Booking from "./models/booking"
import BookingPayment from "./models/booking-payment"

class SellerModuleService extends MedusaService({ Seller, Checkout, SellerDocument, StoreVisit, Dispute, DisputeFile, ProductReport, StockAlert, BookingService, Booking, BookingPayment }) {}

export default SellerModuleService
