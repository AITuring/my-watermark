import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { AppContents } from "./App";
import { loadLanding, routeLoaders } from "./app/route-loading";

export async function render(path: string): Promise<string> {
    const load = path === "/" ? loadLanding : routeLoaders.find((item) => item.url === path)?.component;
    if (!load) throw new Error(`Cannot prerender unknown route: ${path}`);
    const { default: InitialPage } = await load();
    return renderToString(
        <StaticRouter location={path}>
            <AppContents initialPath={path} InitialPage={InitialPage} />
        </StaticRouter>
    );
}
