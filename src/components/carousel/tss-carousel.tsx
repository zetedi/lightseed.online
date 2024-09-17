import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export function TssImageCarousel() {
  return (
    <Carousel className="w-3/5 max-w-sm">
      <CarouselContent className="-ml-1">
        {Array.from({ length: 8 }).map((_, index) => (
          <CarouselItem key={index} className="pl-1 xs:basis-full md:basis-1/2">
            <img
              className="w-full"
              src={"tss/" + index + ".jpg"}
              alt={"The process #" + index}
            />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}
