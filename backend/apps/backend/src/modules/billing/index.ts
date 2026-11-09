import { Module } from "@medusajs/framework/utils"
import BillingModuleService from "./service"

export const BILLING_MODULE = "billing"

export default Module(BILLING_MODULE, { service: BillingModuleService })
