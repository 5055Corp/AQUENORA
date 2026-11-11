import { Module } from "@medusajs/framework/utils"
import ResearchModuleService from "./service"

export const RESEARCH_MODULE = "research"

export default Module(RESEARCH_MODULE, { service: ResearchModuleService })
