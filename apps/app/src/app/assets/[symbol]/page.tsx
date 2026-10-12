import { AssetPage } from "@/components/pages/asset";

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  return { title: (await params).symbol.toUpperCase() };
}
export default AssetPage;
