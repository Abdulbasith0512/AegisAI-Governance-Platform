"use client";

import React from "react";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { HeroSection } from "@/components/landing/HeroSection";
import { GovernanceSimulator } from "@/components/landing/GovernanceSimulator";
import { PillarsGrid } from "@/components/landing/PillarsGrid";
import { ArchitectureFlow } from "@/components/landing/ArchitectureFlow";
import { ComplianceMatrix } from "@/components/landing/ComplianceMatrix";
import { ModuleGrid } from "@/components/landing/ModuleGrid";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function Home() {
  return (
    <div
      className="min-h-screen text-[#FAFAFA] font-sans antialiased flex flex-col justify-between selection:bg-[#10B981] selection:text-white"
      style={{ background: "#0A0A0B" }}
    >
      {/* Top Header Navbar */}
      <LandingHeader />

      {/* Main Content Sections */}
      <main className="flex-1">
        <HeroSection />
        <GovernanceSimulator />
        <PillarsGrid />
        <ArchitectureFlow />
        <ComplianceMatrix />
        <ModuleGrid />
      </main>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
