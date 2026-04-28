const footerStoreLinks = [
	{
		label: "IWantClips",
		href: "https://iwantclips.com/store/174442/Eva-de-Vil",
		icon: "iwantclips.svg",
		extraClass: "footer-link-iwc",
	},
	{
		label: "OnlyFans",
		href: "https://onlyfans.com/evadevil",
		icon: "onlyfans.svg",
		extraClass: "footer-link-wide",
	},
	{
		label: "Clips4Sale",
		href: "https://www.clips4sale.com/studio/122965/eva-de-vil",
		icon: "clips4sale.svg",
		extraClass: "footer-link-wide",
	},
	{
		label: "LoyalFans",
		href: "https://www.loyalfans.com/theevadevil",
		icon: "loyalfans.svg",
		extraClass: "footer-link-wide",
	},
];

const footerSocialLinks = [
	{
		label: "Bluesky",
		href: "https://bsky.app/profile/theevadevil.bsky.social",
		icon: "bluesky.svg",
	},
	{
		label: "Reddit",
		href: "https://www.reddit.com/r/EvaDeVil/",
		icon: "reddit.svg",
	},
	{
		label: "X.com",
		href: "https://x.com/TheEvaDeVil",
		icon: "x.svg",
	},
	{
		label: "Instagram",
		href: "https://www.instagram.com/evadevilgoddess",
		icon: "instagram.svg",
	},
];

function appendTextElement(parent, tagName, className, text) {
	const element = document.createElement(tagName);
	element.className = className;
	element.textContent = text;
	parent.append(element);
	return element;
}

function createFooterLink(
	{ href, label, icon, extraClass = "" },
	kind,
	assetPrefix,
) {
	const link = document.createElement("a");
	link.className = ["footer-link", `footer-link-${kind}`, extraClass]
		.filter(Boolean)
		.join(" ");
	link.href = href;
	link.target = "_blank";
	link.rel = "noopener noreferrer";
	link.setAttribute("aria-label", label);

	const image = document.createElement("img");
	image.className = "footer-icon";
	image.src = `${assetPrefix}${icon}`;
	image.alt = "";
	image.setAttribute("aria-hidden", "true");

	link.append(image);
	return link;
}

class EvaFooter extends HTMLElement {
	connectedCallback() {
		if (this.dataset.ready) return;

		const assetPrefix = this.getAttribute("asset-prefix") || "assets/";
		const footer = document.createElement("footer");
		footer.className = "site-footer";

		const identity = document.createElement("div");
		identity.className = "footer-identity";
		const copyright = appendTextElement(
			identity,
			"span",
			"footer-copyright",
			"©",
		);
		copyright.setAttribute("aria-label", "Copyright");

		const brandLockup = document.createElement("div");
		brandLockup.className = "footer-brand-lockup";
		const brand = appendTextElement(
			brandLockup,
			"a",
			"footer-brand",
			"Eva de Vil",
		);
		brand.href = "https://evadevil.com/";
		brand.rel = "noopener";
		brand.setAttribute("aria-label", "Visit Eva de Vil main site");
		appendTextElement(brandLockup, "span", "footer-year", "2026");
		identity.append(brandLockup);

		const nav = document.createElement("nav");
		nav.className = "footer-links";
		nav.setAttribute("aria-label", "Eva de Vil links");

		const stores = document.createElement("div");
		stores.className = "footer-link-group";
		stores.setAttribute("aria-label", "Creator stores");
		footerStoreLinks.forEach((link) => {
			stores.append(createFooterLink(link, "adult", assetPrefix));
		});

		const socials = document.createElement("div");
		socials.className = "footer-link-group footer-link-group-social";
		socials.setAttribute("aria-label", "Social profiles");
		footerSocialLinks.forEach((link) => {
			socials.append(createFooterLink(link, "social", assetPrefix));
		});

		nav.append(stores, socials);
		footer.append(identity, nav);
		this.dataset.ready = "true";
		this.replaceChildren(footer);
	}
}

customElements.define("eva-footer", EvaFooter);
