/* eslint-disable jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label */
import { Button } from "@keiri/ui/components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@keiri/ui/components/empty";
import { HomeIcon } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden">
      <Empty>
        <EmptyHeader>
          <EmptyTitle className="mask-b-from-20% mask-b-to-80% font-extrabold text-9xl">404</EmptyTitle>
          <EmptyDescription className="-mt-8 text-nowrap text-foreground/80">
            The page you're looking for might have been <br />
            moved or doesn't exist.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex gap-2">
            {/* eslint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label */}
            {/* biome-ignore lint/a11y/useAnchorContent: Button injects children into the rendered <a> via base-ui render prop */}
            <Button render={<a href="/" />} nativeButton={false}>
              <HomeIcon data-icon="inline-start" />
              Go dashboard
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}
