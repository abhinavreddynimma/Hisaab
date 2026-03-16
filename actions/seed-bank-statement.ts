"use server";

import { db } from "@/db";
import { bankStatementEntries } from "@/db/schema";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// SBI Statement: 01-04-2026 to 13-04-2026, Account: 37210069211
const SBI_APRIL_2026 = [
  {
    date: "2026-04-02",
    description: "DEP TFR NEFT*CHAS0INBX01*CHASH00014323920*DxO Labs SAS*BA 0099509044300 AT 20100 SIDDIPET",
    refNo: "CHAS0INBX01",
    debit: null,
    credit: 1243395.15,
    balance: 1277178.44,
  },
  {
    date: "2026-04-02",
    description: "WDL TFR IMPS/609211530945/HDFC-xx593-Balamani/Transfer 0098292162098 AT 20100 SIDDIPET",
    refNo: "609211530945",
    debit: 10000,
    credit: null,
    balance: 1267178.44,
  },
  {
    date: "2026-04-02",
    description: "WDL TFR IMPS/609211539942/HDFC-xx593-Balamani/Transfer 0098292162098 AT 20100 SIDDIPET",
    refNo: "609211539942",
    debit: 200000,
    credit: null,
    balance: 1067178.44,
  },
  {
    date: "2026-04-02",
    description: "WDL TFR IMPS/609211540666/HDFC-xx593-Balamani/Transfer 0098292162098 AT 20100 SIDDIPET",
    refNo: "609211540666",
    debit: 200000,
    credit: null,
    balance: 867178.44,
  },
  {
    date: "2026-04-02",
    description: "WDL TFR IMPS/609211542388/HDFC-xx593-Balamani/Transfer 0098292162098 AT 20100 SIDDIPET",
    refNo: "609211542388",
    debit: 50000,
    credit: null,
    balance: 817178.44,
  },
  {
    date: "2026-04-02",
    description: "WDL TFR IMPS/609211543463/HDFC-xx593-Balamani/Transfer 0098292162098 AT 20100 SIDDIPET",
    refNo: "609211543463",
    debit: 40000,
    credit: null,
    balance: 777178.44,
  },
  {
    date: "2026-04-02",
    description: "WDL TFR UPI/DR/746716959087/Modani S/SBIN/9849316131/Paym 0097693162093 AT 20100 SIDDIPET",
    refNo: "746716959087",
    debit: 7000,
    credit: null,
    balance: 770178.44,
  },
  {
    date: "2026-04-02",
    description: "WDL TFR IMPS/609215730447/ICIC-xx101-Rohith G/Transfer 0098292162098 AT 20100 SIDDIPET",
    refNo: "609215730447",
    debit: 250000,
    credit: null,
    balance: 520178.44,
  },
  {
    date: "2026-04-02",
    description: "WDL TFR SBIY226092171215252917618/M/Transfer to Family or 0052127541815 OF Mr. NIMMA RAJIREDDY AT 20100 SIDDIPET",
    refNo: "SBIY226092171215252917618",
    debit: 100000,
    credit: null,
    balance: 420178.44,
  },
  {
    date: "2026-04-02",
    description: "WDL TFR SBIY226092171248064750832/M/Transfer to Family or 0052127541815 OF Mr. NIMMA RAJIREDDY AT 20100 SIDDIPET",
    refNo: "SBIY226092171248064750832",
    debit: 100000,
    credit: null,
    balance: 320178.44,
  },
  {
    date: "2026-04-02",
    description: "WDL TFR UPI/DR/017289757864/98666549/SBIN/9866654974/Paym 0097693162093 AT 20100 SIDDIPET",
    refNo: "017289757864",
    debit: 89430,
    credit: null,
    balance: 230748.44,
  },
  {
    date: "2026-04-03",
    description: "WDL TFR SBIY226093071031842751998/M/Transfer to Family or 0052127541815 OF Mr. NIMMA RAJIREDDY AT 20100 SIDDIPET",
    refNo: "SBIY226093071031842751998",
    debit: 100000,
    credit: null,
    balance: 130748.44,
  },
  {
    date: "2026-04-03",
    description: "WDL TFR UPI/DR/103038664415/APPLE ME/HDFC/appleservi/Exec 0097694162092 AT 20100 SIDDIPET",
    refNo: "103038664415",
    debit: 119,
    credit: null,
    balance: 130629.44,
  },
  {
    date: "2026-04-04",
    description: "WDL TFR UPI/DR/606468844438/SHAIK MA/IOBA/7386449100/Paym 0097695162091 AT 20100 SIDDIPET",
    refNo: "606468844438",
    debit: 200,
    credit: null,
    balance: 130429.44,
  },
  {
    date: "2026-04-05",
    description: "WDL TFR UPI/DR/655960971370/PUDHARI /IOBA/rajeshgoud/Paym 0097696162090 AT 20100 SIDDIPET",
    refNo: "655960971370",
    debit: 400,
    credit: null,
    balance: 130029.44,
  },
  {
    date: "2026-04-05",
    description: "WDL TFR UPI/DR/570096276137/PEDDI /KKBK/praneethpe/Paym 0097696162090 AT 20100 SIDDIPET",
    refNo: "570096276137",
    debit: 3999,
    credit: null,
    balance: 126030.44,
  },
  {
    date: "2026-04-05",
    description: "WDL TFR UPI/DR/609513180786/TECSO CH/AIRP/tecsocharg/Pay 0097696162090 AT 20100 SIDDIPET",
    refNo: "609513180786",
    debit: 228.58,
    credit: null,
    balance: 125801.86,
  },
  {
    date: "2026-04-05",
    description: "WDL TFR UPI/DR/388218880956/Google P/UTIB/playstore@/Mand 0097696162090 AT 20100 SIDDIPET",
    refNo: "388218880956",
    debit: 59,
    credit: null,
    balance: 125742.86,
  },
  {
    date: "2026-04-06",
    description: "WDL TFR UPI/DR/194299837392/MOHAMMED/YESB/paytm.s1qo/Paym 0097690162095 AT 20100 SIDDIPET",
    refNo: "194299837392",
    debit: 75,
    credit: null,
    balance: 125667.86,
  },
  {
    date: "2026-04-06",
    description: "WDL TFR UPI/DR/659160464367/Modani S/SBIN/9849316131/Paym 0097690162095 AT 20100 SIDDIPET",
    refNo: "659160464367",
    debit: 1000,
    credit: null,
    balance: 124667.86,
  },
  {
    date: "2026-04-08",
    description: "WDL TFR UPI/DR/103077044168/APPLE ME/HDFC/appleservi/Exec 0097692162094 AT 20100 SIDDIPET",
    refNo: "103077044168",
    debit: 119,
    credit: null,
    balance: 124548.86,
  },
  {
    date: "2026-04-08",
    description: "WDL TFR UPI/DR/776849842607/Utkarsh /UTKS/sccpay1@ut/Paym 0097692162094 AT 20100 SIDDIPET",
    refNo: "776849842607",
    debit: 15757.60,
    credit: null,
    balance: 108791.26,
  },
  {
    date: "2026-04-10",
    description: "DEBIT ACHDr BARB00136 000009936 BOB LOAN COLLE",
    refNo: "BARB00136",
    debit: 39041,
    credit: null,
    balance: 69750.26,
  },
  {
    date: "2026-04-10",
    description: "WDL TFR UPI/DR/435967766331/CARPLUS/HDFC/carplus1.e/Payme 0097694162092 AT 20100 SIDDIPET",
    refNo: "435967766331",
    debit: 2490,
    credit: null,
    balance: 67260.26,
  },
  {
    date: "2026-04-11",
    description: "WDL TFR UPI/DR/960816691860/Mr KOLAP/CBIN/kolapuramr/Paym 0097695162091 AT 20100 SIDDIPET",
    refNo: "960816691860",
    debit: 670,
    credit: null,
    balance: 66590.26,
  },
  {
    date: "2026-04-12",
    description: "WDL TFR UPI/DR/396192668584/PEDDI JAYA/ANDB/9290911200/Pa 0097696162090 AT 20100 SIDDIPET",
    refNo: "396192668584",
    debit: 300,
    credit: null,
    balance: 66290.26,
  },
];

export async function seedSBIApril2026() {
  // Check if already seeded (avoid duplicates)
  const existing = await db
    .select({ count: sql<number>`count(*)` })
    .from(bankStatementEntries)
    .where(sql`${bankStatementEntries.accountNumber} = '37210069211' AND ${bankStatementEntries.date} >= '2026-04-01' AND ${bankStatementEntries.date} <= '2026-04-13'`);

  if (existing[0].count > 0) {
    return { seeded: false, message: "Already imported" };
  }

  await db.insert(bankStatementEntries).values(
    SBI_APRIL_2026.map(e => ({
      ...e,
      accountNumber: "37210069211",
      bankName: "State Bank of India",
    }))
  );

  revalidatePath("/expenses-2");
  return { seeded: true, message: `Imported ${SBI_APRIL_2026.length} transactions` };
}
