import { Href, Link } from 'expo-router';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { type ComponentProps, type ReactNode } from 'react';

type Props = Omit<ComponentProps<typeof Link>, 'href' | 'asChild' | 'children'> & {
  href: Href & string;
  children: ReactNode;
};

export function ExternalLink({ href, children, ...rest }: Props) {
  return (
    <Link
      target="_blank"
      href={href}
      asChild
      {...rest}
      onPress={async (event) => {
        if (process.env.EXPO_OS !== 'web') {
          // Prevent the default behavior of linking to the default browser on native.
          event.preventDefault();
          // Open the link in an in-app browser.
          await openBrowserAsync(href, {
            presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
          });
        }
      }}>
      {children}
    </Link>
  );
}
