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
  const gridBgStyle = {
    backgroundImage:
      "linear-gradient(to right, rgba(26,160,168,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(26,160,168,0.02) 1px, transparent 1px)",
    backgroundSize: "40px 40px",
  };

  return (
    <div
      className="min-h-screen bg-[#070b12] text-[#e2e8f0] font-sans antialiased flex flex-col justify-between selection:bg-[#1AA0A8] selection:text-slate-950 border-t-4 border-[#1AA0A8]"
      style={gridBgStyle}
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
