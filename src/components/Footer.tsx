const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="w-full py-8 text-center text-sm text-muted-foreground/70 bg-transparent">
      <p>© {currentYear} Pravin Raj Portfolio</p>
    </footer>
  );
};

export default Footer;
